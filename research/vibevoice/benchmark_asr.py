"""
VibeVoice ASR Test Harness
Issue #55: R&D1 — Comprehensive Testing on VibeVoice

Uses HuggingFace Spaces Gradio API (free tier) to test VibeVoice-ASR
and compare with ElevenLabs Scribe v1.

Requirements:
  pip install gradio_client requests
"""

import json
import time
import os
from pathlib import Path

# --- Configuration ---
VIBEVOICE_SPACE = "microsoft/VibeVoice-ASR"
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/speech-to-text"
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

# GuidedGrowth-specific hotwords for semantic testing
GUIDEDGROWTH_HOTWORDS = "GuidedGrowth, check-in, meditation, journaling, habit streak, morning routine, sleep quality, mood tracking"

# Test cases with ground truth transcriptions
TEST_CASES = [
    {
        "id": "short-command-1",
        "description": "Simple habit completion",
        "ground_truth": "Mark meditation as done",
        "duration_sec": 2.0,
    },
    {
        "id": "short-command-2",
        "description": "Numeric metric logging",
        "ground_truth": "Log 8 hours of sleep",
        "duration_sec": 2.0,
    },
    {
        "id": "medium-sentence",
        "description": "Multi-detail completion",
        "ground_truth": "I completed my morning run today, 5 kilometers in 28 minutes",
        "duration_sec": 5.0,
    },
    {
        "id": "domain-specific",
        "description": "GuidedGrowth domain terms",
        "ground_truth": "Open my GuidedGrowth check-in and log my habit streak for journaling",
        "duration_sec": 5.0,
    },
]


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculate Word Error Rate (WER) between reference and hypothesis."""
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()
    
    # Levenshtein distance at word level
    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]
    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j
    
    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                d[i][j] = min(
                    d[i - 1][j] + 1,      # deletion
                    d[i][j - 1] + 1,      # insertion
                    d[i - 1][j - 1] + 1,  # substitution
                )
    
    if len(ref_words) == 0:
        return 0.0 if len(hyp_words) == 0 else 1.0
    return d[len(ref_words)][len(hyp_words)] / len(ref_words)


def test_vibevoice_asr(audio_path: str, hotwords: str = "") -> dict:
    """Test VibeVoice ASR via HuggingFace Space Gradio API."""
    try:
        from gradio_client import Client
    except ImportError:
        return {"error": "gradio_client not installed. Run: pip install gradio_client"}
    
    client = Client(VIBEVOICE_SPACE)
    
    start_time = time.time()
    result = client.predict(
        media_input={"video": audio_path},
        temp=0,
        top_p=0.8,
        do_sample=False,
        context_info=hotwords,
        api_name="/predict",
    )
    latency_ms = (time.time() - start_time) * 1000
    
    # result is typically a tuple: (transcription, segments_html, video_html, srt_path)
    transcript = result[0] if isinstance(result, (list, tuple)) else str(result)
    
    return {
        "provider": "VibeVoice-ASR",
        "transcript": transcript,
        "latency_ms": round(latency_ms, 2),
        "hotwords_used": hotwords,
    }


def test_elevenlabs_stt(audio_path: str) -> dict:
    """Test ElevenLabs Scribe v1 STT API."""
    import requests
    
    if not ELEVENLABS_API_KEY:
        return {"error": "ELEVENLABS_API_KEY not set"}
    
    with open(audio_path, "rb") as f:
        files = {"file": ("recording.wav", f, "audio/wav")}
        data = {
            "model_id": "scribe_v1",
            "language_code": "en",
            "tag_audio_events": "false",
            "diarize": "false",
        }
        
        start_time = time.time()
        response = requests.post(
            ELEVENLABS_API_URL,
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            files=files,
            data=data,
            timeout=30,
        )
        latency_ms = (time.time() - start_time) * 1000
    
    if not response.ok:
        return {"error": f"ElevenLabs API error: {response.status_code}"}
    
    result = response.json()
    return {
        "provider": "ElevenLabs-Scribe-v1",
        "transcript": result.get("text", ""),
        "latency_ms": round(latency_ms, 2),
    }


def run_benchmark(audio_dir: str = "./samples") -> list:
    """Run full benchmark comparing VibeVoice vs ElevenLabs on all test cases."""
    results = []
    
    for test in TEST_CASES:
        audio_path = os.path.join(audio_dir, f"{test['id']}.wav")
        if not os.path.exists(audio_path):
            print(f"⚠ Skipping {test['id']}: audio file not found at {audio_path}")
            continue
        
        print(f"\n🎤 Testing: {test['description']}")
        print(f"   Ground truth: \"{test['ground_truth']}\"")
        
        # Test VibeVoice (with and without hotwords)
        vv_result = test_vibevoice_asr(audio_path)
        vv_result_hotwords = test_vibevoice_asr(audio_path, GUIDEDGROWTH_HOTWORDS)
        
        # Test ElevenLabs
        el_result = test_elevenlabs_stt(audio_path)
        
        # Calculate WER
        for r in [vv_result, vv_result_hotwords, el_result]:
            if "error" not in r:
                r["wer"] = round(calculate_wer(test["ground_truth"], r["transcript"]), 4)
        
        result_entry = {
            "test_id": test["id"],
            "description": test["description"],
            "ground_truth": test["ground_truth"],
            "vibevoice": vv_result,
            "vibevoice_hotwords": vv_result_hotwords,
            "elevenlabs": el_result,
        }
        results.append(result_entry)
        
        # Print summary
        for label, r in [("VibeVoice", vv_result), ("VibeVoice+Hotwords", vv_result_hotwords), ("ElevenLabs", el_result)]:
            if "error" in r:
                print(f"   {label}: ERROR - {r['error']}")
            else:
                print(f"   {label}: \"{r['transcript']}\" (WER: {r.get('wer', 'N/A')}, Latency: {r['latency_ms']}ms)")
    
    return results


if __name__ == "__main__":
    print("=" * 60)
    print("VibeVoice ASR Benchmark — Issue #55 R&D")
    print("=" * 60)
    
    results = run_benchmark()
    
    # Save results
    output_path = Path(__file__).parent / "benchmark_results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Results saved to {output_path}")
