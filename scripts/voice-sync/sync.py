#!/usr/bin/env python3
"""Voice Sync Script — fetches voice lines from Google Sheets, generates MP3s
via Cartesia TTS, and writes to public/voice/ + updates voice-manifest.json.

Usage:
    python scripts/voice-sync/sync.py

Requires:
    - service-account.json in project root (gitignored)
    - CARTESIA_API_KEY in .env or .env.local
    - GOOGLE_SHEET_ID in .env or .env.local
"""

import csv
import hashlib
import json
import os
import re
import time
from pathlib import Path
import requests
from dotenv import load_dotenv

# Load env from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.local")

# ─── Config ──────────────────────────────────────────────────────────────────

MANIFEST_PATH = PROJECT_ROOT / "src" / "data" / "voice-manifest.json"
OUTPUT_DIR = PROJECT_ROOT / "public" / "voice"

CARTESIA_API_KEY = os.environ.get("CARTESIA_API_KEY", "")
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "")
SERVICE_ACCOUNT_FILE = PROJECT_ROOT / "service-account.json"

# Supabase Storage (per Architecture Doc Section 6.2)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "voice-assets")

# Use founder's cloned voice from env, fallback to Katie (female) default
VOICE_ID = os.environ.get("CARTESIA_VOICE_MALE", "f786b574-daa5-4673-aa0c-cbe3e8534c02")


def _get_sheets_data() -> list[list[str]]:
    """Fetch voice lines from Google Sheets API using service account."""
    if not SERVICE_ACCOUNT_FILE.exists():
        print(f"WARNING: {SERVICE_ACCOUNT_FILE} not found. Falling back to local CSV.")
        return _get_csv_data()

    if not GOOGLE_SHEET_ID:
        print("WARNING: GOOGLE_SHEET_ID not set. Falling back to local CSV.")
        return _get_csv_data()

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build

        creds = Credentials.from_service_account_file(
            str(SERVICE_ACCOUNT_FILE),
            scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
        )
        service = build("sheets", "v4", credentials=creds)
        sheet = service.spreadsheets()

        result = sheet.values().get(
            spreadsheetId=GOOGLE_SHEET_ID,
            range="Voice Export!A2:K1000",
        ).execute()

        rows = result.get("values", [])
        if not rows:
            print("WARNING: Google Sheets returned empty data. Falling back to CSV.")
            return _get_csv_data()

        print(f"Fetched {len(rows)} rows from Google Sheets.")
        return rows
    except Exception as exc:
        print(f"WARNING: Google Sheets fetch failed ({exc}). Falling back to CSV.")
        return _get_csv_data()


def _get_csv_data() -> list[list[str]]:
    """Fallback: read voice lines from local CSV."""
    csv_path = PROJECT_ROOT / "src" / "data" / "voice-lines.csv"
    if not csv_path.exists():
        print(f"ERROR: CSV file not found at {csv_path}.")
        raise SystemExit(1)

    rows: list[list[str]] = []
    with open(csv_path, "r", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        for row in reader:
            rows.append(row)
    print(f"Loaded {len(rows)} rows from local CSV.")
    return rows


def _compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


def _generate_audio(text: str) -> bytes:
    """Generate MP3 via Cartesia TTS API."""
    response = requests.post(
        "https://api.cartesia.ai/tts/bytes",
        headers={
            "Authorization": f"Bearer {CARTESIA_API_KEY}",
            "Content-Type": "application/json",
            "Cartesia-Version": "2026-03-01",
        },
        json={
            "model_id": "sonic-3",
            "transcript": text.strip(),
            "voice": {"mode": "id", "id": VOICE_ID},
            "output_format": {"container": "mp3", "encoding": "mp3", "sample_rate": 24000},
            "language": "en",
        },
        timeout=30,
    )
    if not response.ok:
        raise RuntimeError(f"Cartesia TTS failed with status {response.status_code}")
    return response.content


def _clean_text(raw: str) -> str:
    """Strip coaching brackets, quotes, and leading speaker labels."""
    text = raw.replace('"', "").replace("\n", " ")
    text = re.sub(r"\[.*?\]", "", text).strip()
    colon_idx = text.find(":")
    if 0 < colon_idx < 40 and "." not in text[:colon_idx]:
        text = text[colon_idx + 1 :].strip()
    return text


def _upload_to_supabase(filename: str, audio: bytes) -> str | None:
    """Upload MP3 to Supabase Storage. Returns public URL or None on failure."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None

    try:
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "audio/mpeg",
                "x-upsert": "true",
            },
            data=audio,
            timeout=30,
        )
        if resp.ok:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"
            return public_url
        print(f" upload failed ({resp.status_code})", end="")
    except Exception as exc:
        print(f" upload error ({exc})", end="")
    return None


def main() -> None:
    if not CARTESIA_API_KEY:
        print("ERROR: CARTESIA_API_KEY not set.")
        raise SystemExit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing manifest
    manifest: dict = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            manifest = {}
    files: dict = manifest.get("files", {})

    # Fetch data — Google Sheets first, CSV fallback
    print("Fetching voice line data...")
    rows = _get_sheets_data()

    generated = 0
    skipped = 0
    failed = 0

    for row in rows:
        if len(row) < 10:
            continue

        file_id = row[0].strip()
        if not file_id or file_id.startswith("#"):
            continue

        # Sanitize file_id to prevent path traversal
        if not re.match(r"^[a-zA-Z0-9_\-]+$", file_id):
            print(f"  Skipping invalid file_id: {file_id!r}")
            continue

        # Column 9 = "MP3?" flag
        is_mp3 = row[9].strip().lower() == "yes" if len(row) > 9 else False
        if not is_mp3:
            continue

        # Column 5 = AI Response, fallback to column 3 (AI Voice)
        ai_text = row[5].strip() if len(row) > 5 else ""
        if not ai_text or ai_text == "-":
            ai_text = row[3].strip() if len(row) > 3 else ""
        if not ai_text:
            continue

        text = _clean_text(ai_text)
        text_hash = _compute_hash(text)

        # Derive screen/trigger from file_id pattern
        screen = row[1].strip() if len(row) > 1 else "unknown"
        trigger = "screen_load"

        # Skip unchanged
        filename = f"{file_id}.mp3"
        filepath = OUTPUT_DIR / filename
        if files.get(file_id, {}).get("hash") == text_hash and filepath.exists():
            skipped += 1
            continue

        try:
            print(f"  Generating: {file_id}...", end="", flush=True)
            audio = _generate_audio(text)

            # Write local copy (static fallback for Vercel)
            filepath.write_bytes(audio)

            # Upload to Supabase Storage (per Architecture Doc Section 2.2)
            supabase_url = _upload_to_supabase(filename, audio)

            # Manifest URL: prefer Supabase Storage, fallback to local
            manifest_url = supabase_url or f"/voice/{filename}"

            files[file_id] = {
                "url": manifest_url,
                "hash": text_hash,
                "screen": screen,
                "trigger": trigger,
                "size_bytes": len(audio),
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            }
            uploaded = " + uploaded" if supabase_url else ""
            print(f" done ({len(audio) / 1024:.1f} KB{uploaded})")
            generated += 1
            time.sleep(0.1)  # Rate limit
        except Exception as exc:
            print(f" FAILED: {exc}")
            failed += 1

    # Write manifest
    manifest["_comment"] = "Auto-generated by scripts/voice-sync/sync.py"
    manifest["_generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    manifest["files"] = files
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(f"\nResults: {generated} generated, {skipped} unchanged, {failed} failed")
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
