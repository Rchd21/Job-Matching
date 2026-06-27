# CVMatch 🎯

Analyseur de match CV / offre d'emploi propulsé par Claude (Anthropic).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | Python 3.12 + FastAPI |
| IA | Claude claude-sonnet-4-6 via API Anthropic |
| Extraction PDF | pdfplumber |
| Frontend | HTML / CSS / JS vanilla |
| Reverse proxy | Nginx |
| Déploiement | Docker Compose |

## Architecture

```
Browser
  │
  ▼
Nginx :80
  ├── /           → frontend/index.html
  └── /api/*      → backend:8000/*
                        │
                        ├── POST /analyze
                        │     ├── Lit le CV (PDF/DOCX/TXT)
                        │     ├── Lit l'offre
                        │     ├── Appelle Claude API
                        │     └── Retourne JSON structuré
                        └── GET /health
```

## Démarrage rapide

### 1. Prérequis
- Docker + Docker Compose installés
- Une clé API Anthropic (https://console.anthropic.com)

### 2. Cloner et configurer
```bash
git clone <ton-repo>
cd cvmatch

cp .env.example .env
# Édite .env et mets ta vraie clé ANTHROPIC_API_KEY
```

### 3. Lancer
```bash
docker compose up --build
```

Ouvre http://localhost dans ton navigateur.

### 4. Arrêter
```bash
docker compose down
```

## Structure du projet

```
cvmatch/
├── backend/
│   ├── main.py           # API FastAPI (routes + logique)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── index.html        # UI complète (HTML/CSS/JS)
├── nginx/
│   └── default.conf      # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── README.md
```

## Endpoints API

### `POST /analyze`
Analyse le match entre un CV et une offre.

**Form data :**
- `cv_file` (obligatoire) — fichier CV (PDF, DOCX, TXT)
- `offer_file` (optionnel) — fichier offre
- `offer_text` (optionnel) — texte de l'offre

**Réponse JSON :**
```json
{
  "score": 78,
  "label": "Très bon match",
  "summary": "...",
  "matched_skills": ["Python", "FastAPI", ...],
  "missing_skills": ["Kubernetes", ...],
  "bonus_skills": ["Docker", ...],
  "improvements": [
    { "title": "Ajouter Kubernetes", "detail": "..." }
  ]
}
```

### `GET /health`
Vérification que le serveur tourne.

## Déploiement en production

Pour déployer sur un VPS (DigitalOcean, OVH, etc.) :

```bash
# Sur le serveur
git clone <ton-repo> && cd cvmatch
cp .env.example .env && nano .env  # ajoute ta clé
docker compose up -d --build
```

Pour HTTPS, ajoute Certbot + Nginx SSL (voir docs Nginx).
