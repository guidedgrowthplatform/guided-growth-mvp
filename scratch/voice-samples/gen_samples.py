#!/usr/bin/env python3
"""One-off sample generator for onboarding voice approval (test-first, 6 clips only).

Locked onboarding-mp3 preset:
  model_id: sonic-3.5-2026-05-04
  voice id: 104635f9-8991-403c-9988-bc5b70b39939 (Pro Voice Clone V1)
  speed: slow, emotion: none, language: en
  output: WAV 44100 Hz / 16-bit / mono
  endpoint: https://api.cartesia.ai/tts/bytes, version 2024-11-13
"""
import json
import sys
from pathlib import Path

import requests

KEY_PATH = Path.home() / ".config" / "guided-growth" / "cartesia-key.txt"
OUT_DIR = Path("/Users/yairamsel/Developer/claude-work/gg-status/scratch/voice-samples")

MODEL_ID = "sonic-3.5-2026-05-04"
VOICE_ID = "104635f9-8991-403c-9988-bc5b70b39939"
ENDPOINT = "https://api.cartesia.ai/tts/bytes"
VERSION = "2024-11-13"

CLIPS = [
    ("sample_morning_setup", "You'll do this each day. Two reasons. One, it's a quick read on how you're doing, and it's usually not done enough even though it's beneficial. Two, over time it shows the link between what you do and how you feel. When works each morning? I'd say about 15 minutes after you wake up."),
    ("sample_advanced", "Read me the habits you already track. We'll pick days next. For now just the list, and I recommend starting small, you can always add more."),
    ("sample_frequency", "Not every habit needs to be daily. Some make sense every day, some a few times a week, some once a week. Set each one to what fits."),
    ("sample_ack_protein_breakfast", "Solid. Protein early keeps your energy steady all morning."),
    ("sample_ack_no_screens_10pm", "Good call. Screens off late and your body winds down on time."),
    ("sample_ack_no_cigs", "Strong one, and worth every bit. I'm with you on it."),
]


def main() -> int:
    if not KEY_PATH.exists():
        sys.stderr.write(f"Missing API key file: {KEY_PATH}\n")
        return 1
    api_key = KEY_PATH.read_text(encoding="utf-8").strip()
    if not api_key:
        sys.stderr.write(f"Empty API key file: {KEY_PATH}\n")
        return 1

    headers = {
        "X-API-Key": api_key,
        "Cartesia-Version": VERSION,
        "Content-Type": "application/json",
    }

    results = []
    for slug, text in CLIPS:
        payload = {
            "model_id": MODEL_ID,
            "transcript": text,
            "voice": {"mode": "id", "id": VOICE_ID},
            "output_format": {
                "container": "wav",
                "encoding": "pcm_s16le",
                "sample_rate": 44100,
            },
            "language": "en",
            "speed": "slow",
            "emotion": "none",
        }
        print(f"... generating {slug} ({len(text)} chars)")
        try:
            resp = requests.post(ENDPOINT, headers=headers, data=json.dumps(payload), timeout=60)
        except requests.RequestException as exc:
            print(f"FAIL {slug}: network error: {exc}")
            return 1

        if resp.status_code != 200:
            print(f"FAIL {slug}: HTTP {resp.status_code}: {resp.text[:800]}")
            return 1

        audio = resp.content
        if not audio:
            print(f"FAIL {slug}: empty audio body")
            return 1

        out_path = OUT_DIR / f"{slug}.wav"
        out_path.write_bytes(audio)
        print(f"PASS {slug}: {len(audio)} bytes -> {out_path}")
        results.append((slug, text, out_path, len(audio)))

    print(f"\nDone: {len(results)}/{len(CLIPS)} clips generated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
