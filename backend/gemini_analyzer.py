import os
import json
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY")
GEMINI_DEBUG = os.getenv("GEMINI_DEBUG", "false").lower() == "true"
GEMINI_URL = (
    "https://aiplatform.googleapis.com/v1/publishers/google/models/"
    "gemini-2.5-flash-lite:streamGenerateContent"
)

SYSTEM_PROMPT = """
Jesteś ekspertem od wyceny szkód samochodowych.
Przeanalizuj zdjęcie i zwróć WYŁĄCZNIE poprawny JSON z listą uszkodzeń.
Jeśli widzisz choć cień ryzyka uszkodzenia, dodaj pozycję o niskiej pewności.
Nie pomijaj drobnych uszkodzeń (rys, otarć, wgniotek, pęknięć lakieru).

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

Zasady:
- Odpowiedź ma być wyłącznie jednym obiektem JSON.
- Bez komentarzy, bez markdown, bez prefiksów/sufiksów.
- Jeśli brak widocznych szkód, zwróć pustą listę damages i koszty 0.
"""


def _empty_result(extra: dict | None = None) -> dict:
    result = {
        "damages": [],
        "hidden_damage_predictions": [],
        "total_repair_estimate_pln": 0,
        "total_asm_estimate_pln": 0,
    }
    if extra:
        result.update(extra)
    return result


def _extract_first_json_object(text: str) -> str | None:
    """
    Wyciąga pierwszy poprawny blok JSON {...} z tekstu.
    Działa nawet gdy model doda otaczający tekst.
    """
    if not text:
        return None

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return None


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
                        "text": (
                            f"Samochód: {car_model}. "
                            "Zidentyfikuj wszystkie widoczne uszkodzenia i podaj realistyczną wycenę "
                            "naprawy (nie tylko ASO). Uwzględnij opcję naprawy zamiast wymiany, jeśli ma sens."
                        )
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    if not GEMINI_API_KEY:
        return _empty_result({"error": "Missing GEMINI_API_KEY"})

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

    # Dla streamGenerateContent chunki mogą dzielić tokeny w środku stringów JSON,
    # więc łączymy bez separatora, aby nie psuć składni.
    raw_text = "".join(raw_text_parts).strip()
    if not raw_text:
        return _empty_result({"error": "Gemini returned empty text"})

    # Usuń ewentualne ```json bloki
    clean = raw_text.strip().removeprefix("```json").removesuffix("```").strip()
    extracted = _extract_first_json_object(clean) or clean

    try:
        parsed = json.loads(extracted)
        if not isinstance(parsed, dict):
            return _empty_result({"error": "Gemini response is not a JSON object"})
        return parsed
    except json.JSONDecodeError:
        # Fallback diagnostyczny – łatwiej zobaczyć czemu model nie zwrócił poprawnego JSON
        extra = {"error": "Gemini JSON parse error"}
        if GEMINI_DEBUG:
            extra["gemini_raw_preview"] = raw_text[:1200]
        return _empty_result(extra)
