# R&D1-04: Cartesia.ai Feasibility Evaluation for Sprint 3

## Executive Summary

Cartesia.ai's **Sonic-3** TTS engine is a strong candidate for replacing our current Web Speech API fallback in Guided Growth. It offers **sub-100ms latency** (40-90ms TTFA), natural conversational audio with emotional expression, and 42+ language support — all critical for our voice-first onboarding experience.

**Verdict: ✅ Feasible and Recommended for Sprint 3 integration as a TTS upgrade.**

---

## 1. Technical Evaluation

### Architecture
Cartesia uses **State Space Models (SSMs)** instead of traditional Transformers. This architectural choice gives it a massive latency advantage — ideal for our real-time conversational onboarding flow where the AI needs to respond immediately after parsing voice input.

### Key Capabilities

| Feature | Cartesia Sonic-3 | Our Current (Web Speech API) |
|---|---|---|
| **Latency (TTFA)** | 40–90ms | ~0ms (local) but robotic |
| **Voice Quality** | Natural, expressive | OS-dependent, often robotic |
| **Emotional Control** | Yes (`[laughter]`, speed, volume) | None |
| **Multilingual** | 42+ languages | OS-dependent |
| **Offline** | ❌ (cloud API) | ✅ |
| **Cost** | Credit-based (see below) | Free |

### API Integration Complexity
- **HTTP REST + WebSocket** streaming support
- Requires API version header (e.g., `2026-03-01`)
- Standard auth via API key
- **Effort estimate: ~4 hours** to integrate into our existing `tts-service.ts`

---

## 2. Pricing Analysis (for Guided Growth)

### Credit System
- **1 credit = 1 character** of TTS output
- Free tier: **10,000 credits** (testing only, no commercial use)
- Pro tier: Prepaid monthly commitment

### Cost Estimation for Our App
Average onboarding prompt length: ~120 characters × 8 steps = **~960 characters per user onboarding session**.

| Scale | Characters/month | Estimated Cost |
|---|---|---|
| 100 users | 96,000 | Free tier covers it |
| 1,000 users | 960,000 | ~$10-20/month (Pro) |
| 10,000 users | 9.6M | ~$100-200/month (Scale) |

**Conclusion:** Cost is negligible at our current MVP scale.

---

## 3. Comparison with Alternatives

### vs. ElevenLabs
- ElevenLabs has **better voice cloning** and emotional depth for narration/audiobooks
- But Cartesia wins on **latency** (40ms vs 75-300ms) — critical for our real-time flow
- ElevenLabs is more expensive per character

### vs. Web Speech API (Current)
- Web Speech is **free and offline** but sounds **robotic**
- Cartesia would make our AI coach sound like a real human
- Web Speech remains our **offline fallback**

### Recommendation
Use **Cartesia Sonic-3** as primary TTS, keep **Web Speech API** as offline/error fallback.

---

## 4. Integration Plan for Sprint 3

### Phase 1: Setup (2 hours)
- Create Cartesia API account and get API key
- Add `CARTESIA_API_KEY` to `.env.local` and Vercel env vars
- Create `src/lib/services/cartesia-tts.ts` service module

### Phase 2: Integration (4 hours)
- Modify `tts-service.ts` to add Cartesia as primary provider
- Implement WebSocket streaming for real-time audio playback
- Add fallback to Web Speech API when Cartesia is unavailable

### Phase 3: Testing (2 hours)
- Test latency in onboarding flow
- Verify emotional tone matches our conversational prompts
- Test offline fallback behavior

### Total Estimated Effort: **~8 hours (1 sprint day)**

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| API downtime | Fallback to Web Speech API |
| Latency in poor network | Use WebSocket streaming, not full audio download |
| Cost overrun at scale | Monitor usage, set budget alerts |
| Free tier limits during dev | Use sparingly, upgrade to Pro when needed |

---

## 6. Checklist (Issue #60)

- [x] Research Cartesia.ai capabilities, pricing, and API
- [x] Compare with current TTS solution and alternatives
- [ ] Build proof-of-concept integration (Sprint 3)
