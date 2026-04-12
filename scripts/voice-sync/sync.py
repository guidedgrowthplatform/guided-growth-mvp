#!/usr/bin/env python3
import os
import json
import hashlib
import time
import requests
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# --- Config ---
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), '../../src/data/voice-manifest.json')
SHEET_ID = os.environ.get('VOICE_SHEET_ID')  # e.g., '1BxiMVs0XRY...'
RANGE_NAME = 'Voice System!A2:K1000' # Make sure this matches your CSV tab

CARTESIA_API_KEY = os.environ.get('CARTESIA_API_KEY')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
CARTESIA_VOICE_ID = os.environ.get('CARTESIA_VOICE_ID', '79a125e8-cd45-4c13-8a67-188112f4dd22')

# For MVP, assume bucket name is 'voice-assets'
BUCKET_NAME = 'voice-assets'

# --- Initialization ---
if not all([CARTESIA_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    print("ERROR: Missing required environment variables.")
    print("Please set CARTESIA_API_KEY, VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_csv_data():
    import csv
    csv_path = os.path.join(os.path.dirname(__file__), '../../src/data/voice-lines.csv')
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found at {csv_path}.")
        exit(1)
        
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append(row)
    return rows

def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def generate_audio(text: str, output_path: str):
    print(f"  Generating audio with Cartesia: '{text[:30]}...'")
    url = "https://api.cartesia.ai/tts/bytes"
    headers = {
        "Cartesia-Version": "2024-06-10",
        "X-API-Key": CARTESIA_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "model_id": "sonic-english",
        "transcript": text,
        "voice": {
            "mode": "id",
            "id": CARTESIA_VOICE_ID
        },
        "output_format": {
            "container": "mp3",
            "encoding": "mp3",
            "sample_rate": 44100
        }
    }
    res = requests.post(url, headers=headers, json=payload)
    if not res.ok:
        raise Exception(f"Cartesia API failed: {res.status_code} {res.text}")
    
    with open(output_path, 'wb') as f:
        f.write(res.content)
    return len(res.content)

def upload_to_supabase(local_path: str, remote_path: str) -> str:
    print(f"  Uploading to Supabase storage: {remote_path}")
    with open(local_path, 'rb') as f:
        # Avoid upload issues by removing the old file if it exists
        try:
            supabase.storage.from_(BUCKET_NAME).remove([remote_path])
        except Exception:
            pass
        response = supabase.storage.from_(BUCKET_NAME).upload(remote_path, f)
        
    # Get public URL
    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(remote_path)
    return public_url

def main():
    print("Fetching data from local CSV...")
    rows = get_csv_data()
    
    print("Loading local manifest...")
    manifest = {}
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
                if content.strip(): 
                    manifest = json.loads(content)
        except Exception as e:
            print(f"Warning: Failed to load manifest ({e}). Creating new.")
            manifest = {}
    else:
        print("No manifest found. Creating new.")

    dirty = False
    
    for row in rows:
        if len(row) < 11:
            continue
            
        file_id = row[0]
        # Ignore empty IDs or categories/headers
        if not file_id or not file_id.startswith('ONBOARD-') and not '-0' in file_id:
            continue
            
        is_mp3 = row[9].lower().strip() == 'yes'
        if not is_mp3:
            continue
            
        ai_response = row[5].strip()
        if ai_response == '-' or not ai_response:
            # fallback to AI Voice column if response is empty
            ai_response = row[3].strip()
            
        # Clean up text (remove coaching bracket tags)
        import re
        text_to_speak = ai_response.replace('"', '').replace('\n', ' ')
        text_to_speak = re.sub(r'\[.*?\]', '', text_to_speak).strip()
        if ':' in text_to_speak and text_to_speak.index(':') < 40 and '.' not in text_to_speak[:text_to_speak.index(':')]:
             text_to_speak = text_to_speak[text_to_speak.index(':')+1:].strip()
        current_hash = compute_hash(text_to_speak)
        
        manifest_entry = manifest.get(file_id, {})
        if manifest_entry.get('hash') == current_hash:
            print(f"[{file_id}] OK - No changes.")
            continue
            
        print(f"[{file_id}] CHANGES DETECTED. Re-generating...")
        
        temp_audio = f"/tmp/{file_id}.mp3"
        remote_path = f"{file_id}.mp3"
        
        try:
            # 1. Generate audio
            size = generate_audio(text_to_speak, temp_audio)
            
            # 2. Upload to Supabase
            url = upload_to_supabase(temp_audio, remote_path)
            
            # 3. Update manifest
            manifest[file_id] = {
                "file_id": file_id,
                "text": text_to_speak,
                "hash": current_hash,
                "url": url,
                "size_bytes": size,
                "updated_at": int(time.time() * 1000)
            }
            dirty = True
            print(f"  -> Success. URL: {url}")
        except Exception as e:
            print(f"  -> Failed to sync {file_id}: {e}")
        finally:
            if os.path.exists(temp_audio):
                os.remove(temp_audio)
                
    if dirty:
        print("Saving updated manifest...")
        with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        print("Done.")
    else:
        print("No changes needed. Manifest is up to date.")

if __name__ == "__main__":
    main()
