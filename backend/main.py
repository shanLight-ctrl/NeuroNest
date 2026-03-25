import os
import io
import json
import re
import httpx
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from gtts import gTTS

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

app = FastAPI(title="NeuroNest API", version="1.0.0")

# Allow requests from your GitHub Pages frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to your GitHub Pages URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_KEY = os.environ.get("GEMINI_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


# ── Models ──

class ContentRequest(BaseModel):
    content: str
    style: str = "podcast"  # for audio mode

class CardsRequest(BaseModel):
    content: str
    mode: str  # "simplify" | "flashcards" | "explain" | "both"

class QuizRequest(BaseModel):
    content: str

class ImageRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"


# ── Gemini helper ──

async def call_gemini(prompt: str, max_tokens: int = 4096) -> str:
    if not GEMINI_KEY:
        raise HTTPException(500, "GEMINI_KEY not configured on server.")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{GEMINI_URL}?key={GEMINI_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": max_tokens}
            }
        )
        if not r.is_success:
            raise HTTPException(r.status_code, r.json().get("error", {}).get("message", "Gemini error"))
        return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


def strip_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json(text: str):
    text = strip_fences(text)
    start = text.find("[") if "[" in text else text.find("{")
    end = text.rfind("]") if "[" in text else text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)


# ── Routes ──

@app.get("/")
def root():
    return {"status": "ok", "message": "NeuroNest API is running"}


@app.post("/audio")
async def generate_audio(req: ContentRequest):
    """Convert academic content to a spoken audio script."""
    if req.style == "normal":
        prompt = (
            "Rewrite the following academic content as a clear, spoken audio explanation. "
            "Write ONLY for the ear — no markdown, no bullet points, no symbols. "
            "Use simple, direct language. Explain each concept clearly and in order. "
            "Preserve all technical accuracy. Return only the spoken script.\n\n"
            f"Content:\n{req.content}"
        )
    else:
        prompt = (
            "Rewrite the following academic content as a natural, engaging podcast-style spoken audio script. "
            "Write ONLY for the ear — no markdown, no bullet points, no symbols. "
            "Use natural spoken transitions like 'Now here's the interesting part' or 'Think of it this way'. "
            "Preserve all technical accuracy. Return only the spoken script.\n\n"
            f"Content:\n{req.content}"
        )
    script = await call_gemini(prompt)
    word_count = len(script.split())
    return {
        "script": script,
        "estimated_minutes": round(word_count / 150, 1),
        "style": req.style
    }


@app.post("/cards")
async def generate_cards(req: CardsRequest):
    """Simplify content, generate flashcards, explain, or all three."""
    result = {}

    if req.mode in ("simplify", "both"):
        simplified = await call_gemini(
            "Rewrite in plain, clear language for a non-native English speaker. "
            "Keep all technical terms but explain each in brackets on first use. "
            "Preserve all facts. Return only the rewritten text.\n\n" + req.content
        )
        result["simplified"] = simplified

    if req.mode == "explain":
        explained = await call_gemini(
            "Explain step by step using simple language and real-world analogies. "
            "Make it feel like a knowledgeable friend explaining. "
            "Preserve technical accuracy. Return only the explanation.\n\n" + req.content
        )
        result["explained"] = explained

    if req.mode in ("flashcards", "both"):
        raw = await call_gemini(
            "Extract the 6-10 most important terms and concepts from the following academic content. "
            "Return ONLY a valid JSON array, no markdown:\n"
            '[{"term":"...","definition":"One clear sentence.","category":"..."}]\n\n'
            + req.content
        )
        result["flashcards"] = extract_json(raw)

    return result


@app.post("/quiz")
async def generate_quiz(req: QuizRequest):
    """Generate a 3-level progressive quiz from academic content."""
    raw = await call_gemini(
        "Create a 3-level quiz from the following academic content.\n"
        "Level 1 = basic recall (easy), Level 2 = understanding (medium), Level 3 = application (hard).\n"
        "Each level has exactly 3 multiple choice questions.\n"
        "Return ONLY a valid JSON array, no markdown:\n"
        '[{"level":1,"title":"Level 1: Recall","questions":'
        '[{"q":"...","options":["A","B","C","D"],"correct":0,"feedback":"Revision tip if wrong."}]}]\n\n'
        f"Content:\n{req.content}",
        max_tokens=4096
    )
    return {"levels": extract_json(raw)}


@app.post("/extract-image")
async def extract_image_text(req: ImageRequest):
    """Extract text from an image using Gemini Vision."""
    if not GEMINI_KEY:
        raise HTTPException(500, "GEMINI_KEY not configured on server.")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{GEMINI_URL}?key={GEMINI_KEY}",
            json={
                "contents": [{"parts": [
                    {"text": "Extract all the text from this image accurately. Return only the extracted text, preserving its structure. If handwritten, transcribe it clearly."},
                    {"inline_data": {"mime_type": req.mime_type, "data": req.image_base64}}
                ]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096}
            }
        )
        if not r.is_success:
            raise HTTPException(r.status_code, r.json().get("error", {}).get("message", "Gemini error"))
        return {"text": r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()}


@app.post("/audio/download")
async def download_audio(req: ContentRequest):
    """Convert script text to MP3 and return as downloadable file."""
    tts = gTTS(text=req.content, lang='en', slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/mpeg",
        headers={"Content-Disposition": "attachment; filename=NeuroNest_Audio.mp3"})
