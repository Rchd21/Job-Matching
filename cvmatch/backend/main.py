import os
import io
import json
import logging
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import Groq
import pdfplumber
import docx2txt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CVMatch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract plain text from PDF, DOCX, or TXT."""
    name = filename.lower()

    if name.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(
                page.extract_text() or "" for page in pdf.pages
            )

    if name.endswith(".docx"):
        return docx2txt.process(io.BytesIO(file_bytes))

    return file_bytes.decode("utf-8", errors="ignore")


def build_prompt(cv_text: str, offer_text: str) -> str:
    return f"""Tu es un expert RH et coach carrière senior. Analyse le match entre ce CV et cette offre d'emploi.

CV DU CANDIDAT :
{cv_text[:4000]}

OFFRE D'EMPLOI :
{offer_text[:3000]}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après.
Structure exacte :
{{
  "score": <entier 0-100>,
  "label": "<verdict court, ex: Très bon match>",
  "summary": "<2-3 phrases, ton direct et honnête sur l'adéquation globale>",
  "matched_skills": ["<compétence présente dans le CV ET requise par l'offre>", ...],
  "missing_skills": ["<compétence requise par l'offre mais absente du CV>", ...],
  "bonus_skills": ["<atout du CV non demandé mais valorisant>", ...],
  "improvements": [
    {{
      "title": "<action concrète courte>",
      "detail": "<explication précise: quoi faire, où l'ajouter dans le CV, pourquoi ça aide>"
    }}
  ]
}}"""


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyze")
async def analyze(
    cv_file: UploadFile = File(...),
    offer_file: UploadFile = File(None),
    offer_text: str = Form(""),
):
    # 1. Extract CV text
    cv_bytes = await cv_file.read()
    try:
        cv_text = extract_text_from_file(cv_bytes, cv_file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Impossible de lire le CV : {e}")

    if not cv_text.strip():
        raise HTTPException(status_code=400, detail="Le CV semble vide ou illisible.")

    # 2. Extract offer text
    final_offer = offer_text.strip()
    if offer_file:
        offer_bytes = await offer_file.read()
        try:
            final_offer = extract_text_from_file(offer_bytes, offer_file.filename)
        except Exception as e:
            logger.warning(f"Impossible de lire le fichier offre : {e}")

    if not final_offer:
        raise HTTPException(status_code=400, detail="Merci de fournir une offre d'emploi.")

    # 3. Call Groq (Llama 3.3 70B)
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1500,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": "Tu es un expert RH. Tu réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour."
                },
                {
                    "role": "user",
                    "content": build_prompt(cv_text, final_offer)
                }
            ],
        )
        raw = completion.choices[0].message.content.strip()
        # Strip markdown fences if model adds them anyway
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Réponse IA invalide, réessaie.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur API Groq : {e}")

    logger.info(f"Analyse terminée — score: {result.get('score')}%")
    return JSONResponse(content=result)
