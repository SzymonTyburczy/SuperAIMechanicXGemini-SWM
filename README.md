# Smart Pitstop AI – Backend (Osoba A)

## Struktura repo

```
smart-pitstop/
├── docker-compose.yml        # Fishjam + Smelter + Backend razem
├── backend/
│   ├── main.py               # FastAPI - room management, endpointy
│   ├── gemini_analyzer.py    # Analiza klatek przez Gemini Vision
│   ├── smelter_pipeline.py   # Sterowanie Smelter (AR overlaye)
│   ├── requirements.txt
│   └── .env                  # FISHJAM_API_TOKEN, GEMINI_API_KEY
└── smelter/
    └── pipeline.json         # Konfiguracja kompozycji AR (opcjonalna)
```

## Uruchomienie

```bash
# 1. Skopiuj zmienne środowiskowe
cp backend/.env.example backend/.env
# uzupełnij GEMINI_API_KEY

# 2. Uruchom wszystko
docker-compose up

# Backend dostępny na: http://localhost:8000
# Fishjam dashboard: http://localhost:5002
# Smelter output stream: http://localhost:8083
```

## Endpointy backendu

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/room` | Tworzy pokój Fishjam, zwraca token dla frontu |
| POST | `/api/analyze` | Wysyła klatkę do Gemini, zwraca uszkodzenia |
| POST | `/api/smelter/start` | Startuje pipeline AR w Smelter |
| GET  | `/api/room/{id}` | Stan pokoju |
