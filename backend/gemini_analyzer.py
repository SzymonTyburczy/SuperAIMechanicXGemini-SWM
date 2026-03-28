import os
import json
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY")
GEMINI_URL = (
    "https://aiplatform.googleapis.com/v1/publishers/google/models/"
    "gemini-2.5-flash-lite:streamGenerateContent"
)

SYSTEM_PROMPT = """
Jesteś ekspertem od wyceny szkód samochodowych.
Przeanalizuj zdjęcie i zwróć JSON z listą uszkodzeń.

Format odpowiedzi (tylko JSON, bez markdown):
{
  "damages": [
    {
      "part": "nazwa części po polsku",
      "type": "typ uszkodzenia (wgniecenie/zarysowanie/pęknięcie/etc)",
      "severity": "low|medium|high",
      "repair_cost_pln": 150,
      "replace_cost_asm": 1800,
      "can_repair": true,
      "bbox_hint": "lewy-przód|prawy-tył|przód|tył|etc"
    }
  ],
  "hidden_damage_predictions": [
    {
      "part": "nazwa części",
      "probability_pct": 70,
      "reason": "powód predykcji",
      "cost_pln": 500
    }
  ],
  "total_repair_estimate_pln": 650,
  "total_asm_estimate_pln": 3600
}
"""


async def analyze_frame(frame_base64: str, car_model: str) -> dict:
    """
    Wysyła klatkę do Gemini Vision i zwraca sparsowany JSON z uszkodzeniami.
    """
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": frame_base64,
                        }
                    },
                    {
                        "text": f"Samochód: {car_model}. Zidentyfikuj wszystkie widoczne uszkodzenia."
                    },
                ]
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
    }

    if not GEMINI_API_KEY:
        return {
            "damages": [],
            "hidden_damage_predictions": [],
            "total_repair_estimate_pln": 0,
            "total_asm_estimate_pln": 0,
            "error": "Missing GEMINI_API_KEY",
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()

    try:
        response_json = resp.json()
    except json.JSONDecodeError:
        # Fallback dla odpowiedzi strumieniowej/SSE (linie: data: {...})
        response_json = []
        for line in resp.text.splitlines():
            if not line.startswith("data:"):
                continue
            raw = line.removeprefix("data:").strip()
            if not raw or raw == "[DONE]":
                continue
            try:
                response_json.append(json.loads(raw))
            except json.JSONDecodeError:
                continue

    # streamGenerateContent może zwrócić listę chunków zamiast pojedynczego obiektu
    candidates = []
    if isinstance(response_json, list):
        for chunk in response_json:
            candidates.extend(chunk.get("candidates", []))
    else:
        candidates = response_json.get("candidates", [])

    raw_text_parts = []
    for candidate in candidates:
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                raw_text_parts.append(text)

    raw_text = "\n".join(raw_text_parts).strip()
    if not raw_text:
        return {
            "damages": [],
            "hidden_damage_predictions": [],
            "total_repair_estimate_pln": 0,
            "total_asm_estimate_pln": 0,
        }

    # Usuń ewentualne ```json bloki
    clean = raw_text.strip().removeprefix("```json").removesuffix("```").strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Fallback – zwróć pusty wynik zamiast crashować
        return {
            "damages": [],
            "hidden_damage_predictions": [],
            "total_repair_estimate_pln": 0,
            "total_asm_estimate_pln": 0,
        }
