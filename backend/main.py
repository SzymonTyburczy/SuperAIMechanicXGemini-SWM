from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os

from gemini_analyzer import analyze_frame
from smelter_pipeline import start_ar_pipeline, update_ar_overlays

app = FastAPI(title="Smart Pitstop AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FISHJAM_URL = os.getenv("FISHJAM_URL", "http://localhost:5002")
FISHJAM_API_TOKEN = os.getenv("FISHJAM_API_TOKEN", "development")
FISHJAM_HEADERS = {
    "Authorization": f"Bearer {FISHJAM_API_TOKEN}",
    "Content-Type": "application/json",
}


# ─── FISHJAM – room management ───────────────────────────────────────────────

@app.post("/api/room")
async def create_room():
    """
    Front wywołuje to przy starcie sesji.
    Zwraca peerToken – front przekazuje go do @fishjam-dev/react-client-sdk
    żeby dołączyć do pokoju przez WebRTC.
    """
    async with httpx.AsyncClient() as client:
        room_resp = await client.post(
            f"{FISHJAM_URL}/room",
            headers=FISHJAM_HEADERS,
            json={"maxPeers": 10, "videoCodec": "h264"},
        )
        if room_resp.status_code != 201:
            raise HTTPException(500, f"Fishjam error: {room_resp.text}")

        room_id = room_resp.json()["data"]["room"]["id"]

        peer_resp = await client.post(
            f"{FISHJAM_URL}/room/{room_id}/peer",
            headers=FISHJAM_HEADERS,
            json={"type": "webrtc"},
        )
        if peer_resp.status_code != 201:
            raise HTTPException(500, f"Peer error: {peer_resp.text}")

        peer_token = peer_resp.json()["data"]["token"]

    # Startuj pipeline AR w Smelterze dla tego pokoju
    await start_ar_pipeline(room_id)

    return {
        "roomId": room_id,
        "peerToken": peer_token,
        "smelterStream": f"http://localhost:8083/output/{room_id}.m3u8",
    }


@app.get("/api/room/{room_id}")
async def get_room(room_id: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FISHJAM_URL}/room/{room_id}", headers=FISHJAM_HEADERS
        )
        if resp.status_code != 200:
            raise HTTPException(404, "Room not found")
        return resp.json()["data"]


@app.delete("/api/room/{room_id}")
async def delete_room(room_id: str):
    async with httpx.AsyncClient() as client:
        await client.delete(
            f"{FISHJAM_URL}/room/{room_id}", headers=FISHJAM_HEADERS
        )
    return {"status": "deleted"}


# ─── GEMINI – analiza klatki ─────────────────────────────────────────────────

class FrameRequest(BaseModel):
    roomId: str
    frameBase64: str   # klatka jako base64 JPEG – front wysyła co ~2s
    carModel: str = "Unknown"


@app.post("/api/analyze")
async def analyze(req: FrameRequest):
    """
    Front przesyła klatkę co ~2 sekundy.
    Backend → Gemini Vision → lista uszkodzeń z kosztami
    → aktualizacja overlayów AR w Smelterze.
    """
    damages = await analyze_frame(req.frameBase64, req.carModel)
    await update_ar_overlays(req.roomId, damages)
    return {"damages": damages}
