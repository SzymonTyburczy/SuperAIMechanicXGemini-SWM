from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
import asyncio
from typing import Dict, List, Set
from datetime import datetime

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


# ─── IN-MEMORY SESSION STORE ────────────────────────────────────────────────

class ScanSession:
    def __init__(self, room_id: str, car_model: str = "Unknown"):
        self.room_id = room_id
        self.car_model = car_model
        self.damages: list = []
        self.hidden_predictions: list = []
        self.total_repair: int = 0
        self.total_asm: int = 0
        self.frame_count: int = 0
        self.created_at: str = datetime.utcnow().isoformat()
        self.completed: bool = False

    def update_from_analysis(self, result: dict):
        """Merge new analysis into accumulated session damages."""
        new_damages = result.get("damages", [])
        new_hidden = result.get("hidden_damage_predictions", [])

        # Deduplicate by part name — keep the latest analysis for each part
        existing_parts = {d["part"] for d in self.damages}
        for dmg in new_damages:
            if dmg.get("part") not in existing_parts:
                self.damages.append(dmg)
                existing_parts.add(dmg["part"])
            else:
                # Update existing entry
                self.damages = [
                    dmg if d["part"] == dmg["part"] else d
                    for d in self.damages
                ]

        # Update hidden predictions
        existing_hidden = {d["part"] for d in self.hidden_predictions}
        for pred in new_hidden:
            if pred.get("part") not in existing_hidden:
                self.hidden_predictions.append(pred)
                existing_hidden.add(pred["part"])

        # Recalculate totals
        self.total_repair = sum(d.get("repair_cost_pln", 0) for d in self.damages)
        self.total_asm = sum(d.get("replace_cost_asm", 0) for d in self.damages)
        self.frame_count += 1

    def to_dict(self) -> dict:
        return {
            "roomId": self.room_id,
            "carModel": self.car_model,
            "damages": self.damages,
            "hidden_damage_predictions": self.hidden_predictions,
            "total_repair_estimate_pln": self.total_repair,
            "total_asm_estimate_pln": self.total_asm,
            "frameCount": self.frame_count,
            "createdAt": self.created_at,
            "completed": self.completed,
        }


# Session store: room_id -> ScanSession
sessions: Dict[str, ScanSession] = {}

# WebSocket connections: room_id -> set of WebSocket connections (report viewers)
report_viewers: Dict[str, Set[WebSocket]] = {}

# Scanner connections: room_id -> WebSocket (mobile scanner)
scanner_connections: Dict[str, WebSocket] = {}


# ─── FISHJAM – room management ───────────────────────────────────────────────

@app.post("/api/room")
async def create_room(car_model: str = "Unknown"):
    """
    Front wywołuje to przy starcie sesji.
    Zwraca peerToken – front przekazuje go do Fishjam SDK
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

    # Create scan session
    sessions[room_id] = ScanSession(room_id, car_model)

    # Start AR pipeline in Smelter for this room
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
    # Clean up session
    sessions.pop(room_id, None)
    return {"status": "deleted"}


# ─── SCAN SESSION ENDPOINTS ──────────────────────────────────────────────────

@app.post("/api/scan/start")
async def start_scan(car_model: str = "Unknown"):
    """
    Lightweight scan start — creates a room_id and session without requiring
    Fishjam (for when Docker services aren't running).
    """
    import uuid
    room_id = str(uuid.uuid4())[:8]
    sessions[room_id] = ScanSession(room_id, car_model)

    # Try to create Fishjam room, but don't fail if unavailable
    peer_token = None
    smelter_stream = None
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            room_resp = await client.post(
                f"{FISHJAM_URL}/room",
                headers=FISHJAM_HEADERS,
                json={"maxPeers": 10, "videoCodec": "h264"},
            )
            if room_resp.status_code == 201:
                fj_room_id = room_resp.json()["data"]["room"]["id"]
                peer_resp = await client.post(
                    f"{FISHJAM_URL}/room/{fj_room_id}/peer",
                    headers=FISHJAM_HEADERS,
                    json={"type": "webrtc"},
                )
                if peer_resp.status_code == 201:
                    peer_token = peer_resp.json()["data"]["token"]
                    smelter_stream = f"http://localhost:8083/output/{fj_room_id}.m3u8"
                    await start_ar_pipeline(fj_room_id)
    except Exception as e:
        print(f"[Scan] Fishjam unavailable, running without WebRTC: {e}")

    return {
        "roomId": room_id,
        "peerToken": peer_token,
        "smelterStream": smelter_stream,
    }


@app.get("/api/scan/{room_id}/results")
async def get_scan_results(room_id: str):
    """Get current accumulated scan results for a room."""
    session = sessions.get(room_id)
    if not session:
        raise HTTPException(404, "Scan session not found")
    return session.to_dict()


@app.post("/api/scan/{room_id}/complete")
async def complete_scan(room_id: str):
    """Mark scan as complete. Returns final results."""
    session = sessions.get(room_id)
    if not session:
        raise HTTPException(404, "Scan session not found")
    session.completed = True

    # Notify all report viewers
    await _broadcast_to_viewers(room_id, {
        "type": "scan_complete",
        "data": session.to_dict(),
    })

    return session.to_dict()


# ─── GEMINI – frame analysis ─────────────────────────────────────────────────

class FrameRequest(BaseModel):
    roomId: str
    frameBase64: str   # klatka jako base64 JPEG – front wysyła co ~1s
    carModel: str = "Unknown"


@app.post("/api/analyze")
async def analyze(req: FrameRequest):
    """
    Front przesyła klatkę co ~1 sekundę.
    Backend → Gemini Vision → lista uszkodzeń z kosztami
    → aktualizacja overlayów AR w Smelterze
    → broadcast do report viewers via WebSocket.
    """
    damages = await analyze_frame(req.frameBase64, req.carModel)

    # Update session
    session = sessions.get(req.roomId)
    if session:
        session.update_from_analysis(damages)

    # Update Smelter AR overlays
    await update_ar_overlays(req.roomId, damages)

    # Broadcast to connected report viewers
    if session:
        await _broadcast_to_viewers(req.roomId, {
            "type": "damage_update",
            "data": session.to_dict(),
        })

    return {"damages": damages, "session": session.to_dict() if session else None}


# ─── WEBSOCKET – real-time sync ──────────────────────────────────────────────

@app.websocket("/ws/scan/{room_id}")
async def ws_scan(websocket: WebSocket, room_id: str):
    """
    WebSocket for real-time scan sync.
    - Mobile scanner sends frames → backend analyzes → broadcasts results
    - Report page connects to receive live damage updates
    """
    await websocket.accept()

    # Determine role from first message
    try:
        init_message = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
    except asyncio.TimeoutError:
        try:
            await websocket.close()
        except Exception:
            pass
        return
    except Exception:
        return

    role = init_message.get("role", "viewer")

    if role == "scanner":
        # Mobile scanner connection
        scanner_connections[room_id] = websocket
        car_model = init_message.get("carModel", "Unknown")

        # Create session if not exists
        if room_id not in sessions:
            sessions[room_id] = ScanSession(room_id, car_model)

        await websocket.send_json({"type": "connected", "roomId": room_id})

        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")

                if msg_type == "frame":
                    # Analyze frame
                    frame_b64 = data.get("frameBase64", "")
                    if frame_b64:
                        result = await analyze_frame(frame_b64, car_model)
                        session = sessions[room_id]
                        session.update_from_analysis(result)

                        # Send back to scanner
                        await websocket.send_json({
                            "type": "analysis_result",
                            "data": result,
                            "session": session.to_dict(),
                        })

                        # Broadcast to report viewers
                        await _broadcast_to_viewers(room_id, {
                            "type": "damage_update",
                            "data": session.to_dict(),
                        })

                        # Update Smelter
                        await update_ar_overlays(room_id, result)

                elif msg_type == "complete":
                    session = sessions.get(room_id)
                    if session:
                        session.completed = True
                        await _broadcast_to_viewers(room_id, {
                            "type": "scan_complete",
                            "data": session.to_dict(),
                        })
                    await websocket.send_json({
                        "type": "scan_complete",
                        "data": session.to_dict() if session else {},
                    })

        except WebSocketDisconnect:
            scanner_connections.pop(room_id, None)

    elif role == "viewer":
        # Report page viewer connection
        if room_id not in report_viewers:
            report_viewers[room_id] = set()
        report_viewers[room_id].add(websocket)

        # Send current state immediately
        session = sessions.get(room_id)
        if session:
            await websocket.send_json({
                "type": "current_state",
                "data": session.to_dict(),
            })

        try:
            while True:
                # Keep connection alive, handle pings
                data = await websocket.receive_json()
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            report_viewers.get(room_id, set()).discard(websocket)


async def _broadcast_to_viewers(room_id: str, message: dict):
    """Send a message to all report viewers for a given room."""
    viewers = report_viewers.get(room_id, set())
    dead = set()
    for ws in viewers:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    viewers -= dead


# ─── HEALTH CHECK ────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "sessions": len(sessions)}
