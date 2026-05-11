# Tasks — Phase 3

Source: Google Sheet **Guided Growth OS App Master** · tab `Tasks` · gid `1687604173` · filtered to **Phase 3**.

**Count:** 2 task(s).

## Quick index

| Task ID | Title | Status | Assignee | Est (h) |
|---|---|---|---|---|
| `P3-01` | Migrate Vapi orchestration to self-hosted Pipecat | Not Started | yonas | 4 |
| `P3-02` | Migrate non-onboarding voice to Cartesia Sonic API direct (cost optimization) | Obsolete | yonas |  |

## Tasks

### P3-01 — Migrate Vapi orchestration to self-hosted Pipecat

**Status:** Not Started · **Priority:** Low · Weight: 8 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 4h · Criteria progress: 3/7

**Description:** Phase 3: migrate Vapi orchestration to self-hosted Pipecat for unit cost reduction at scale.

**Detailed explanation:**

At MVP scale (~hundreds of users), Vapi's per-minute cost is fine. At thousands+ of users, self-hosting orchestration via Pipecat reduces per-call cost ~3-5x. Provider-agnostic by design: swap the orchestration layer without touching the architecture above (callLLM stays unchanged).

SETUP
- Confirm Pipecat is the right choice (re-evaluate vs LiveKit, others)
- Provision infrastructure (Kubernetes? bare ECS?)

BUILD
- Deploy Pipecat with Cartesia STT + TTS plugins (preserves voice quality)
- Wire Cartesia voice_id (cloned voice)
- Migrate Vapi assistant config to Pipecat equivalent
- Switch frontend useRealtimeVoice (P1-16) WebSocket endpoint to Pipecat
- Run both in parallel for one week, compare cost + latency

VERIFY
- Latency budget (P1-45) holds under Pipecat
- Cost per session is measurably lower than Vapi

**Acceptance criteria:**

SETUP
□ Pipecat vs alternatives decision documented

BUILD
□ Pipecat deployed with Cartesia STT/TTS plugins
□ Voice quality matches Vapi (Yair-reviewed by ear)
□ useRealtimeVoice can swap endpoint via env var

VERIFY
□ One week parallel run: latency p95 within 10% of Vapi
□ Per-session cost <30% of Vapi cost
□ Decision to cut over (or roll back) documented at end of parallel run

**Extras:**
- Notes: Begin only when concurrency limits actually bite. Updated 2026-05-05 for Vapi pivot.

---

### P3-02 — Migrate non-onboarding voice to Cartesia Sonic API direct (cost optimization)

**Status:** Obsolete · Tier: Backend · Workstream: Voice · Assignee: yonas

**Description:** Phase 3 cost optimization: replace Vapi for check-ins + free-form voice with Cartesia Sonic API direct calls. Onboarding stays on Vapi for orchestration quality.

**Detailed explanation:**

Phase 3 cost-optimization task. At MVP scale Vapi everywhere is fine. At thousands of users / heavy check-in volume, Vapi's per-minute orchestration cost adds up; Cartesia Sonic API direct (TTS only) is cheaper since we're already managing state on the frontend at that point.

SETUP
- Measure actual per-month Vapi cost for check-ins + free-form voice (post-launch)
- Decide if cost gap is worth the engineering investment
- Confirm Cartesia Sonic API still meets latency/quality requirements

BUILD
- Implement Path 2/3 voice via Cartesia Sonic API direct (callLLM wrapper sends text to Cartesia, audio streamed back)
- State machine for async reflection moves to frontend (PROMPT → LISTENING → THINKING → RESPONDING → DONE)
- Onboarding stays on Vapi (orchestration value > cost there)

VERIFY
- Cost per check-in measurably lower than Vapi
- Latency within 10% of Vapi for check-in turns
- No quality regression in cloned voice

**Acceptance criteria:**

SETUP
□ Cost analysis documented: Vapi vs Sonic API direct, projected at production scale
□ Decision (proceed or stay-on-Vapi) signed off by Yair

BUILD
□ Cartesia Sonic API integration in callLLM Path 2/3
□ Frontend state machine handles async reflection turn-taking
□ Onboarding still on Vapi (verified)

VERIFY
□ Per-check-in cost <70% of Vapi equivalent
□ Latency p95 within 10% of Vapi
□ Yair-reviewed voice quality identical

**Extras:**
- Notes: Obsoleted 2026-05-08: Cartesia Sonic API direct is now MVP architecture (3-path model), not a Phase 3 cost optimization. Was created when we briefly consolidated to Vapi-everywhere; reverted same day.

---

_Last refreshed: 2026-05-11_