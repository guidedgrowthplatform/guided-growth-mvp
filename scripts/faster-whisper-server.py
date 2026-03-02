"""
Faster Whisper REST API Server

A lightweight FastAPI server that wraps faster-whisper for STT.
Deploy this on a VPS with GPU for best performance.

Usage:
    pip install faster-whisper fastapi uvicorn python-multipart
    python server.py

The server exposes an OpenAI-compatible endpoint at /v1/audio/transcriptions
"""

import os
import tempfile
import time
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

app = FastAPI(title="Faster Whisper STT Server")

# CORS for browser requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup
MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "auto")  # "cuda" for GPU, "cpu" for CPU
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")  # "float16" for GPU

print(f"Loading Faster Whisper model: {MODEL_SIZE} on {DEVICE}...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Model loaded!")


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model_name: str = Form(default="faster-whisper"),
    language: str = Form(default=None),
):
    """OpenAI-compatible transcription endpoint"""
    start = time.time()

    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Transcribe
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        transcript = " ".join(text_parts)
        duration = time.time() - start

        return {
            "text": transcript,
            "transcript": transcript,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": round(info.duration, 2),
            "processing_time": round(duration, 3),
            "model": MODEL_SIZE,
        }
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8765"))
    print(f"Starting Faster Whisper server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
