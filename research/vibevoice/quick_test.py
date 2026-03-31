"""
VibeVoice ASR Test v3 — Multi-provider comparison with real latency 
Fixed: chunked transfer for HF API, proper file handling
"""
import requests
import json
import time
import os

ELEVENLABS_API_KEY = "sk_0f820886dc68f0fe05c3c5f3f69f21d052830c77bc02d517"

print("=" * 60)
print("STT Provider Comparison Test v3")
print("=" * 60)

# Download test audio
test_audio_url = "https://huggingface.co/datasets/Narsil/asr_dummy/resolve/main/1.flac"
test_audio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_sample.flac")

if not os.path.exists(test_audio_path):
    print("\nDownloading test audio...")
    import urllib.request
    urllib.request.urlretrieve(test_audio_url, test_audio_path)

file_size = os.path.getsize(test_audio_path)
print(f"Test audio: {test_audio_path} ({file_size} bytes)")

results = {"test_audio": test_audio_url, "file_size_bytes": file_size}

# ─── Test 1: ElevenLabs Scribe v1 ───
print("\n[1/3] ElevenLabs Scribe v1...")
try:
    with open(test_audio_path, "rb") as f:
        start = time.time()
        resp = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            files={"file": ("test.flac", f, "audio/flac")},
            data={"model_id": "scribe_v1", "language_code": "en"},
            timeout=30,
        )
        el_latency = (time.time() - start) * 1000

    if resp.ok:
        el_result = resp.json()
        el_text = el_result.get("text", "")
        print(f"  OK | {el_latency:.0f}ms | \"{el_text[:120]}\"")
        results["elevenlabs"] = {"transcript": el_text, "latency_ms": round(el_latency), "status": "ok"}
    else:
        print(f"  FAIL | {resp.status_code}: {resp.text[:150]}")
        results["elevenlabs"] = {"status": "error", "code": resp.status_code}
except Exception as e:
    print(f"  ERROR | {e}")
    results["elevenlabs"] = {"status": "error", "message": str(e)}

# ─── Test 2: HF Whisper large-v3 (multipart) ───
print("\n[2/3] HF Inference API (Whisper large-v3)...")
try:
    with open(test_audio_path, "rb") as f:
        audio_bytes = f.read()

    start = time.time()
    resp = requests.post(
        "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
        data=audio_bytes,
        timeout=120,
    )
    hf_latency = (time.time() - start) * 1000

    if resp.ok:
        hf_result = resp.json()
        hf_text = hf_result.get("text", str(hf_result))
        print(f"  OK | {hf_latency:.0f}ms | \"{hf_text[:120]}\"")
        results["whisper_v3"] = {"transcript": hf_text, "latency_ms": round(hf_latency), "status": "ok"}
    else:
        body = resp.text[:300]
        print(f"  FAIL | {resp.status_code}: {body}")
        results["whisper_v3"] = {"status": "error", "code": resp.status_code, "body": body}
except Exception as e:
    print(f"  ERROR | {e}")
    results["whisper_v3"] = {"status": "error", "message": str(e)[:200]}

# ─── Test 3: HF VibeVoice-ASR ───
print("\n[3/3] HF Inference API (VibeVoice-ASR)...")
try:
    with open(test_audio_path, "rb") as f:
        audio_bytes = f.read()

    start = time.time()
    resp = requests.post(
        "https://api-inference.huggingface.co/models/microsoft/VibeVoice-ASR-HF",
        data=audio_bytes,
        timeout=120,
    )
    vv_latency = (time.time() - start) * 1000

    if resp.ok:
        vv_result = resp.json()
        vv_text = vv_result.get("text", str(vv_result))
        print(f"  OK | {vv_latency:.0f}ms | \"{vv_text[:120]}\"")
        results["vibevoice_asr"] = {"transcript": vv_text, "latency_ms": round(vv_latency), "status": "ok"}
    else:
        body = resp.text[:300]
        print(f"  FAIL | {resp.status_code}: {body}")
        results["vibevoice_asr"] = {"status": "error", "code": resp.status_code, "body": body}
except Exception as e:
    print(f"  ERROR | {e}")
    results["vibevoice_asr"] = {"status": "error", "message": str(e)[:200]}

# ─── Summary ───
print("\n" + "=" * 60)
print(json.dumps(results, indent=2))

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_results.json")
with open(output_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nSaved: {output_path}")
