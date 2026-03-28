"""
Smelter REST API używa /api/ prefix.
Poprawne endpointy:
    POST /api/input/:input_id/register
    POST /api/output/:output_id/register
    POST /api/output/:output_id/unregister
"""

import os
import httpx

SMELTER_URL = os.getenv("SMELTER_URL", "http://localhost:8081")


async def _post(path: str, body: dict):
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"{SMELTER_URL}{path}", json=body)
        resp.raise_for_status()
        return resp.json()


async def start_ar_pipeline(room_id: str):
    """
    Rejestruje input RTP i output HLS w Smelterze.
    Jeśli Smelter nie odpowiada – nie crashujemy room creation.
    """
    try:
        # 1. Zarejestruj wejście RTP (stream z Fishjama)
        await _post(f"/api/input/fishjam_{room_id}/register", {
            "type": "rtp_stream",
            "transport_protocol": "tcp_server",
            "port": 5004,
            "video": {
                "decoder": "ffmpeg_h264"
            }
        })

        # 2. Zarejestruj wyjście HLS
        await _post(f"/api/output/output_{room_id}/register", {
            "type": "hls",
            "path": f"/output/{room_id}.m3u8",
            "video": {
                "resolution": {"width": 1280, "height": 720},
                "send_eos_when": {"all_inputs": True},
                "encoder": {"type": "ffmpeg_h264"},
                "initial": {
                    "root": {
                        "type": "input_stream",
                        "input_id": f"fishjam_{room_id}",
                    }
                },
            },
        })

        print(f"[Smelter] Pipeline started for room {room_id}")

    except Exception as e:
        # Na hackathonie nie blokujemy room creation jeśli Smelter ma problem
        print(f"[Smelter] Warning – pipeline not started: {e}")


async def update_ar_overlays(room_id: str, damages: dict):
    """
    Aktualizuje scenę Smeltera – nakłada etykiety z kosztami.
    """
    if not damages.get("damages"):
        return

    children = [
        {
            "type": "input_stream",
            "input_id": f"fishjam_{room_id}",
        }
    ]

    POSITION_MAP = {
        "lewy-przód":  {"top": 80,  "left": 60},
        "prawy-przód": {"top": 80,  "left": 900},
        "lewy-tył":    {"top": 400, "left": 60},
        "prawy-tył":   {"top": 400, "left": 900},
        "przód":       {"top": 80,  "left": 480},
        "tył":         {"top": 400, "left": 480},
    }

    for dmg in damages["damages"]:
        pos = POSITION_MAP.get(dmg.get("bbox_hint", "przód"), {"top": 80, "left": 60})
        color = {"low": "#22c55e", "medium": "#f59e0b", "high": "#ef4444"}.get(
            dmg.get("severity", "medium"), "#f59e0b"
        )

        children.append({
            "type": "view",
            "top": pos["top"],
            "left": pos["left"],
            "width": 260,
            "height": 70,
            "children": [
                {
                    "type": "text",
                    "text": f"{dmg['part']} – {dmg['type']}",
                    "font_size": 16,
                    "color_rgba": "#ffffffff",
                    "weight": "bold",
                },
                {
                    "type": "text",
                    "text": f"Naprawa: {dmg['repair_cost_pln']} PLN",
                    "font_size": 14,
                    "color_rgba": color + "ff",
                },
            ],
        })

    total = damages.get("total_repair_estimate_pln", 0)
    children.append({
        "type": "view",
        "bottom": 20,
        "left": 0,
        "width": 1280,
        "height": 44,
        "children": [
            {
                "type": "text",
                "text": f"SUMA NAPRAWY: ~{total} PLN",
                "font_size": 20,
                "color_rgba": "#facc15ff",
                "weight": "bold",
            }
        ],
    })

    try:
        await _post(f"/api/output/output_{room_id}/update", {
            "video": {
                "root": {
                    "type": "view",
                    "children": children,
                }
            }
        })
    except Exception as e:
        print(f"[Smelter] overlay update failed: {e}")