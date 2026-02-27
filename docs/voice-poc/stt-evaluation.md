# STT Provider Evaluation

## Summary

Evaluation of three speech-to-text providers for the Guided Growth voice input pipeline. Tested Web Speech API and Deepgram Nova-2 directly; OpenAI Whisper evaluated via research (no API key provided).

## Provider Comparison

| Criteria | Web Speech API | Deepgram Nova-2/3 | OpenAI Whisper |
|---|---|---|---|
| **Cost** | Free | $200 free credits, then $0.006/min | $0.006/min (no free tier) |
| **Accuracy** | ~90%+ (optimal), variable with accents/noise | 95%+ (Nova-3), best-in-class | 95%+ (GPT-4o Transcribe) |
| **Latency** | <500ms (real-time streaming) | ~500-1500ms (batch), <300ms (streaming) | 1000-3000ms (batch only) |
| **Streaming** | ✅ Native real-time | ✅ WebSocket streaming | ❌ Batch only |
| **Offline** | ❌ Requires server (Chrome sends to Google) | ❌ Cloud API | ❌ Cloud API |
| **Browser Support** | Chrome, Edge, Safari 14.1+ | All (via API) | All (via API) |
| **Firefox** | ❌ Not supported | ✅ Works (API-based) | ✅ Works (API-based) |
| **Mobile (Capacitor)** | ⚠️ Works in WebView (Chrome-based) | ✅ Full support | ✅ Full support |
| **Privacy** | ⚠️ Audio sent to Google servers | Audio sent to Deepgram servers | Audio sent to OpenAI servers |
| **Languages** | 100+ (depends on browser) | 36+ languages | 50+ languages |
| **Speaker Diarization** | ❌ | ✅ | ✅ (GPT-4o model) |
| **SDK** | Browser built-in | JavaScript/Python/Go SDKs | REST API |
| **Max Audio Length** | ~60s per session (auto-stops) | Unlimited (streaming) | 25MB file limit |

## Test Methodology

### Test Harness
A dedicated `/evaluate` page was built with:
- 15 test phrases across 3 categories: short commands (5), longer sentences (5), edge cases (5)
- Audio recording via MediaRecorder API
- Web Speech API tested via live speech recognition
- Deepgram tested via recorded audio sent to Nova-2 REST endpoint
- Accuracy measured by word-level matching against expected text
- Latency measured from request start to transcript received

### Test Phrase Categories
1. **Commands**: "Log my mood as happy", "Start meditation timer", etc.
2. **Sentences**: "I completed thirty minutes of exercise today...", etc.
3. **Edge Cases**: Decimal numbers, homophones, hyphenated dates, technical terms

## Key Findings

### Web Speech API
- **Strengths**: Zero cost, real-time streaming, built into Chrome
- **Weaknesses**: Chrome/Edge only, no Firefox, auto-stops after ~60s silence, variable accuracy with accents, sends audio to Google, continuous mode is buggy on mobile
- **Best for**: Quick prototyping, short command-style inputs

### Deepgram
- **Strengths**: Best accuracy (Nova-3/Nova-2), streaming support, $200 free credits, works in all browsers via API, excellent SDK
- **Weaknesses**: Requires API key and server proxy, paid after credits expire
- **Best for**: Production-quality transcription, cross-browser support

### OpenAI Whisper
- **Strengths**: High accuracy, good language support, GPT-4o model has diarization
- **Weaknesses**: Batch only (no streaming), higher latency, no free tier, 25MB file limit
- **Best for**: Post-processing, transcribing longer recordings, non-real-time use cases

## Recommendation

### For POC/Prototype Phase: **Web Speech API** ✅

Use the Web Speech API for the immediate prototype because:
1. **Zero cost** — no API keys or billing needed
2. **Already integrated** — working in MVP-01's mic button
3. **Real-time** — instant transcript feedback
4. **Good enough** — 90%+ accuracy for clear speech in Chrome

### For Production / Next Phase: **Deepgram Nova-3** (hybrid approach)

When moving beyond prototype:
1. **Primary STT**: Deepgram streaming for real-time transcription in all browsers
2. **Fallback**: Web Speech API when Deepgram is unavailable (offline, quota exceeded)
3. **Rationale**: Deepgram provides better accuracy (95%+), Firefox/Safari support, and streaming — critical for production UX
4. **Cost**: $200 free credits cover ~430 hours → sufficient for months of development

### Why Not Whisper?
Whisper is excellent for batch processing but lacks streaming — a dealbreaker for a "voice-led" app that needs real-time feedback. Consider Whisper only for post-processing journal entries or generating better transcripts from saved audio.

## Environment Setup

```bash
# Required for Deepgram testing
DEEPGRAM_API_KEY=your_key_here

# Optional for Whisper testing
# OPENAI_API_KEY=your_key_here
```

Get Deepgram free credits at [console.deepgram.com/signup](https://console.deepgram.com/signup).
