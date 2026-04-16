# Voice Provider Archive (DISABLED)

These files are **inactive** reference implementations from previous voice providers.
Cartesia (Sonic TTS + Ink STT) is the active provider for MVP.

Per Yair (Apr 16 meeting): "I don't want it to be fully stripped. I want us to be
able to move to ElevenLabs, DeepGram very easily if we want to change."

## Files

| File                             | Provider   | What it did                                                  |
| -------------------------------- | ---------- | ------------------------------------------------------------ |
| `elevenlabs-service.ts.disabled` | ElevenLabs | Full STT service (mic capture, RMS, hallucination detection) |
| `elevenlabs-stt.ts.disabled`     | ElevenLabs | Vercel API endpoint for STT                                  |
| `elevenlabs-tts.ts.disabled`     | ElevenLabs | Vercel API endpoint for TTS                                  |
| `deepgram-token.js.disabled`     | DeepGram   | Vercel API endpoint for project-scoped token                 |

## How to re-enable

1. Rename `.disabled` → `.ts` / `.js`
2. Add API keys to `.env.local` (`ELEVENLABS_API_KEY` / `DEEPGRAM_API_KEY`)
3. Update imports in `stt-service.ts` / `tts-service.ts` to use the provider
4. Add Vercel API endpoints back to `api/` folder
