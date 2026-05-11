# Tasks — Phase 2

Source: Google Sheet **Guided Growth OS App Master** · tab `Tasks` · gid `1687604173` · filtered to **Phase 2**.

**Count:** 14 task(s).

## Quick index

| Task ID | Title | Status | Assignee | Est (h) |
|---|---|---|---|---|
| `OLD-P2-19-20` | Wire all home + check-in screens | Obsolete | TBD | 5 |
| `P2-01` | Add new tools to shared module | Not Started | yonas | 1.5 |
| `P2-02` | Stage 5 prep: scaffold async reflection state machine | Not Started | mintesnotm | 4 |
| `P2-03` | Async reflection check-in flow / state machine | Not Started | mintesnotm | 8 |
| `P2-04` | Feedback sessions via Vapi (scheduled triggers) | Not Started | yonas | 4 |
| `P2-05` | Generate ~30 check-in MP3s (VA-driven, manual) | Not Started | Yair | 6 |
| `P2-06` | Wire HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN | Not Started | mintesnotm | 4 |
| `P2-07` | Wire MCHECK-01, MCHECK-02, ECHECK-01 to ECHECK-06 | Not Started | mintesnotm | 6 |
| `P2-08` | Yair tone bible (voice content reference) | Not Started | Yair | 3 |
| `P2-09` | Text chat integration (GPT-4o mini direct) | Not Started | mintesnotm + yonas | 3 |
| `P2-10` | Streaming text input UX + always-open input box | Not Started | mintesnotm + timothy |  |
| `P2-11` | Wire user research prompt library (BR-01 to BR-18) into LLM | Not Started | yonas |  |
| `P2-12` | Cross-channel QA (HARD GATE) | Not Started | mintesnotm + yonas | 2 |
| `P2-13` | GitLab sync improvements (assignee + status labels) | Not Started | alejandro |  |

## Tasks

### OLD-P2-19-20 — Wire all home + check-in screens

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: TBD · Est: 5h

**Description:** Wire HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN, MCHECK-01, MCHECK-02, ECHECK-01 through ECHECK-06. All use useScreenContext + (Cartesia for voice / useLLM for text).

**Detailed explanation:**

All Phase 2 LLM-active screens. Each: add AI context block to Sheet, run seed_contexts.py, useScreenContext, voice/text path, logEvent. No new LLM infrastructure.

**Extras:**
- Notes: [SUPERSEDED 2026-05-05: split into P2-33 (HOME screens) + P2-34 (MCHECK/ECHECK screens) for cleaner ownership]

---

### P2-01 — Add new tools to shared module

**Status:** Not Started · **Priority:** Medium · Weight: 2 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1.5h · Criteria progress: 0/5

**Description:** Add Phase-2 tools (insights, milestone celebrations, habit edits) to the shared LLM tool module from P1-14.

**Detailed explanation:**

Phase 2 introduces new behaviors that need new LLM tools — show insights, celebrate milestones, edit habit cadence mid-life. All go in the SAME shared tool module so Path 1 + Path 3 see them simultaneously.

SETUP
- Inventory new behaviors needing tool support (output = list of tool stubs)
- Confirm shared tool module conventions (P1-14)

BUILD
- Add 3-5 new tools (e.g. get_insights, celebrate_milestone, edit_habit) with JSON schema
- Each tool calls existing backend endpoint
- Update Vapi assistant config (P1-13) and Direct LLM path (P1-38) to import the new tools

VERIFY
- New tools callable via Vapi voice + Direct LLM text identically

**Acceptance criteria:**

SETUP
□ New tool inventory in /docs/tools-phase2.md

BUILD
□ Each new tool has JSON schema in src/llm/tools.ts
□ Each tool wires to an existing backend endpoint (no new business logic)

VERIFY
□ Voice path can invoke each new tool and get expected response
□ Text path can invoke each new tool with identical payload + response

---

### P2-02 — Stage 5 prep: scaffold async reflection state machine

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Backend · Workstream: Voice · Assignee: mintesnotm · Est: 4h · Criteria progress: 0/6

**Description:** Scaffold the async reflection state machine + useAsyncReflection hook with a mock backend so check-in screen-wire tasks (P2-06, P2-07) can build against a stable interface in parallel.

**Detailed explanation:**

Pre-work for the Stage 5 (Check-ins + text chat + feedback) sprint. Scaffolding async reflection means the screen-wire tasks don't block on backend completion — they can stub against a real interface and swap in the real backend (P2-03) later.

SETUP
- Define the contract: useAsyncReflection() returns {start, stop, status, result}
- Document state machine: idle → recording → processing → result → idle

BUILD
- Implement useAsyncReflection() with a mock backend that returns canned responses
- Document the contract so screen tasks can wire against it now, swap in real backend later

VERIFY
- A test screen using mocked useAsyncReflection works end-to-end
- Real backend (P2-03) can drop in without changing screen code

**Acceptance criteria:**

SETUP
□ Hook contract pinned in /docs/hooks.md
□ State machine documented in /docs/state-machines/async-reflection.md

BUILD
□ useAsyncReflection() exists with mock backend returning canned responses
□ Mock can be swapped via env var or import path (one-line change)

VERIFY
□ A smoke check-in screen using the mock completes the flow
□ Once P2-03 backend lands, no screen-side code changes needed

---

### P2-03 — Async reflection check-in flow / state machine

**Status:** Not Started · **Priority:** High · Weight: 8 · Tier: Backend · Workstream: Voice · Assignee: mintesnotm · Est: 8h · Criteria progress: 0/10

**Description:** Async reflection check-in flow + state machine: user opens check-in, talks about their day, AI processes asynchronously, returns coaching insights via Cartesia Sonic API.

**Detailed explanation:**

Path 2. Unlike Vapi (real-time conversational), Async Reflection accepts a user's free-form input (voice or text), runs LLM analysis in the background, and returns coaching insights when ready. Supports voice via Cartesia Sonic API; text via Direct LLM.

SETUP
- Confirm the state machine: idle → recording → processing → result → idle
- Confirm check-in screen designs in Figma

BUILD
- Implement useAsyncReflection() hook backing onto real backend (replaces mock from P2-02)
- Backend: POST /api/reflection accepts audio (Cartesia Ink STT) / text, kicks off async LLM job
- Polling or SSE returns result when ready
- LLM uses same context shape as Path 1/3 (P1-11 dep)
- Response audio: Cartesia Sonic API direct (NOT Vapi) — cheaper TTS for personalized response

VERIFY
- Check-in completes for both voice + text input
- Response includes specific insight referencing user's habits + recent session_log

**Acceptance criteria:**

SETUP
□ State machine documented in /docs/state-machines/async-reflection.md
□ Check-in Figma frames pinned for reference

BUILD
□ useAsyncReflection() returns {start, stop, status, result}
□ POST /api/reflection accepts both audio (multipart) + text (json)
□ Async job uses shared context builder
□ Response audio comes back via Cartesia Sonic API (not Vapi)

VERIFY
□ Voice check-in: 60s of speech → coaching insight in <30s
□ Text check-in: paragraph → coaching insight in <10s
□ Insight references user's actual habits (not generic)
□ Per-check-in cost <$0.01 (10x cheaper than Vapi-equivalent flow)

---

### P2-04 — Feedback sessions via Vapi (scheduled triggers)

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 4h · Criteria progress: 0/6

**Description:** Feedback sessions via Vapi: scheduled triggers at 1-week / 1-month / on-demand, where the AI proactively reaches out for reflection.

**Detailed explanation:**

Phase 2 retention play. Instead of waiting for the user to open the app, the AI initiates a check-in conversation at meaningful intervals. Uses Vapi (Path 1) since it's a real-time conversation.

SETUP
- Define trigger rules: 7 days after onboarding, 30 days, plus a manual 'request feedback' button

BUILD
- Backend cron: nightly job picks users hitting a trigger date, sends push notification
- On notification tap: launches Vapi assistant with feedback-mode system prompt
- Vapi calls log_event(feedback_completed, payload) to mark done

VERIFY
- Trigger fires for users hitting day 7 / day 30
- Manual button always works
- Feedback session writes session_log entry

**Acceptance criteria:**

SETUP
□ Trigger rules documented in /docs/feedback-triggers.md

BUILD
□ Nightly cron identifies eligible users
□ Push notification + deep link to Vapi feedback session
□ Vapi system prompt has feedback mode covering app experience + coaching satisfaction

VERIFY
□ End-to-end: seeded user hits day 7 → notification → Vapi session → session_log entry
□ Manual feedback button reachable from settings

**Extras:**
- Notes: Stage 5. Plug-and-play once onboarding Vapi is working.

---

### P2-05 — Generate ~30 check-in MP3s (VA-driven, manual)

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Backend · Workstream: Voice · Assignee: Yair · Est: 6h · Criteria progress: 0/6

**Description:** Generate ~30 check-in MP3s in Cartesia playground using Yair's cloned voice (manual content production).

**Detailed explanation:**

Check-in screens use pre-recorded MP3s for the AI's prompts (lower latency than live TTS, less cost). Yair generates the audio in Cartesia playground using his cloned voice. ~30 prompts cover the standard check-in moments.

SETUP
- Confirm prompt scripts in /docs/checkin-scripts.md (or Master Sheet's MP3 Files tab)
- Confirm Cartesia voice_id for cloned voice

BUILD
- For each prompt: paste script into Cartesia playground, generate, download MP3
- Name files per /docs/mp3-naming.md (consistent with existing P1 MP3s)
- Upload to Supabase Storage voice-assets bucket
- Update voice-manifest.json with new entries

VERIFY
- All 30 MP3s playable in browser
- Frontend useVoicePlayer can resolve each by ID

**Acceptance criteria:**

SETUP
□ Prompt scripts finalized
□ Cartesia voice_id confirmed and accessible

BUILD
□ All 30 MP3s generated, named per convention, uploaded to Supabase Storage
□ voice-manifest.json updated with all 30 entries

VERIFY
□ Spot-check 5 random MP3s play correctly via useVoicePlayer
□ Audio quality matches existing P1 MP3s (no clipping, consistent loudness)

**Extras:**
- Notes: Stage 5. CRITICAL PATH. If MP3s aren't ready by week 3, MVP doesn't ship. Yair: 3h. VA: 3h.

---

### P2-06 — Wire HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN

**Status:** Not Started · **Priority:** High · Weight: 5 · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 4h · Criteria progress: 0/6

**Description:** Wire HOME-FIRST, HOME-MORNING, HOME-EVENING, HOME-RETURN screens — primary daily-use surfaces.

**Detailed explanation:**

The 4 home screens users see most often after onboarding. Each has its own AI context block (sheet's Screens tab) and triggers Path 2 or 3 depending on user action (tap a check-in card → Path 2, type in chat → Path 3).

SETUP
- Confirm AI context blocks for all 4 screens are seeded (P1-31)
- Confirm Figma frames pinned

BUILD
- Implement each screen per pattern from P1-17..P1-25 (wire useScreenContext + navigate_next)
- HOME-FIRST: shown after onboarding completes; first impression of daily use
- HOME-MORNING: shown 6am-noon; encourages morning check-in
- HOME-EVENING: shown 5pm-midnight; encourages evening reflection
- HOME-RETURN: shown to returning users (>1 day since last visit)

VERIFY
- Time-of-day routing works
- Each screen's context produces appropriate AI greeting

**Acceptance criteria:**

SETUP
□ All 4 screen_contexts present in Supabase

BUILD
□ Each of 4 screens implemented matching its Figma frame
□ Time-based routing (morning/evening/return) tested with mocked clock

VERIFY
□ Open app at 9am → HOME-MORNING; at 8pm → HOME-EVENING
□ Returning after 24h → HOME-RETURN
□ Each screen's AI greeting reflects its context block

**Extras:**
- Notes: Stage 5. Replaces or extends existing P2-19-20 task. Coordinate.

---

### P2-07 — Wire MCHECK-01, MCHECK-02, ECHECK-01 to ECHECK-06

**Status:** Not Started · **Priority:** High · Weight: 8 · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 6h · Criteria progress: 0/6

**Description:** Wire MCHECK-01, MCHECK-02 (morning check-ins) + ECHECK-01..ECHECK-06 (evening check-in flow).

**Detailed explanation:**

Daily check-in flow screens. Morning is short (2 screens, intent-setting). Evening is longer (6 screens, reflection + planning tomorrow). Most use Async Reflection (Path 2) for the user's free-form input.

SETUP
- Confirm context blocks seeded for all 8 screens
- Confirm useAsyncReflection ready (P2-29)

BUILD
- Wire each screen using P1-17..P1-25 pattern
- MCHECK-01..02: intent for the day; quick (~30 sec total)
- ECHECK-01..06: reflection on day, gratitude, tomorrow's intent (~5 min total)

VERIFY
- Full morning + evening check-in flows complete
- Each writes habit_completion + checkin entries to DB

**Acceptance criteria:**

SETUP
□ All 8 screen_contexts seeded

BUILD
□ All 8 screens implemented per Figma
□ Each step writes appropriate event to session_log

VERIFY
□ End-to-end morning check-in <60s for cooperative user
□ End-to-end evening check-in <8 minutes
□ habit_completions + checkins tables populated correctly after each

**Extras:**
- Notes: Stage 5.

---

### P2-08 — Yair tone bible (voice content reference)

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Both · Workstream: Voice · Assignee: Yair · Est: 3h · Criteria progress: 0/5

**Description:** Yair's tone bible: documented voice/style guide so all AI responses match Yair's coaching voice (warm, direct, curious, no jargon).

**Detailed explanation:**

Voice content reference — written by Yair, used as input to the system prompt + as a quality reference when reviewing AI responses. Defines what 'Yair-style' means concretely.

SETUP
- Yair drafts initial bible based on coaching call transcripts (Yair-content task)

BUILD
- Document at /docs/tone-bible.md covering: warmth signals, directness, curiosity moves, what to avoid
- Include 10+ example exchanges (good vs bad responses)
- Wire excerpts into Vapi assistant system prompt

VERIFY
- AI responses (sample 20) score >8/10 against the bible (Yair reviews)

**Acceptance criteria:**

SETUP
□ /docs/tone-bible.md drafted by Yair

BUILD
□ Tone bible has 10+ example exchanges
□ Vapi system prompt references tone bible (excerpt or summary)

VERIFY
□ Yair samples 20 AI responses post-implementation; ≥18 score 8/10 against bible
□ Tone bible used as canonical reference in code review for any prompt change

**Extras:**
- Notes: Stage 5 prep. Yair work, runs in parallel with Stage 1 engineering.

---

### P2-09 — Text chat integration (GPT-4o mini direct)

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm + yonas · Est: 3h · Criteria progress: 0/6

**Description:** Text chat integration via callLLM() Direct LLM path. No Vapi — uses GPT-4o mini at $0.15/$0.60 per 1M tokens.

**Detailed explanation:**

Pure-text chat input for users who prefer typing or are in environments where voice isn't appropriate. Goes through Path 3 (Direct LLM), uses useLLM (P1-38) hook.

SETUP
- Confirm useLLM hook works (P1-38)
- Confirm useScreenContext provides per-screen context (P1-41)

BUILD
- Build chat UI: input at bottom, message stream above
- Each user message → useLLM.sendMessage(text) → render response
- Persist conversation to session_log (event_type='text_chat_turn')

VERIFY
- 5+ message conversation works end-to-end
- Cost per conversation matches GPT-4o mini pricing budget

**Acceptance criteria:**

SETUP
□ useLLM and useScreenContext exist and tested

BUILD
□ Chat UI matches Figma frame
□ Each message round-trip in <2s p95
□ Conversation persists across screen unmount (session_log)

VERIFY
□ 5-turn conversation completes without error
□ Cost per 100-turn conversation <$0.05 (within GPT-4o mini budget)

**Extras:**
- Notes: Stage 5. No concurrency limits since not Cartesia.

---

### P2-10 — Streaming text input UX + always-open input box

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm + timothy · Criteria progress: 0/6

**Description:** Streaming text input UX (words appear as LLM streams) + always-open input box (fresh empty input below each user message).

**Detailed explanation:**

Two text-input UX details for the chat surface:

STREAMING TEXT
- LLM responses render token-by-token as they arrive (like ChatGPT), not as a single block dropping in
- Feels alive, matches what users expect from modern AI

ALWAYS-OPEN INPUT
- After user submits a message, a fresh empty input field appears immediately below
- User never has to wait/tap to start typing the next message
- Continuous flow

SETUP
- Confirm /api/llm supports SSE for streaming (P1-34 backend dep)
- Coordinate with Timothy on Figma chat overlay redesign

BUILD
- Frontend: subscribe to SSE stream, append tokens as they arrive
- Always-open: render new input at bottom on every submit; auto-focus

VERIFY
- Streaming feels smooth (no jitter, no token drops)
- Always-open input doesn't lose focus on rapid messages

**Acceptance criteria:**

SETUP
□ /api/llm SSE support confirmed (or backend updated)
□ Figma chat overlay redesign approved

BUILD
□ Streaming response renders token-by-token in test conversation
□ Always-open input visible at bottom after every send, auto-focused

VERIFY
□ 10-message rapid conversation: no input lost, no focus stutter
□ Streaming p95 first-token <600ms

**Extras:**
- Notes: Mint + Timothy coordination needed.

---

### P2-11 — Wire user research prompt library (BR-01 to BR-18) into LLM

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Backend · Workstream: Wiring · Assignee: yonas · Criteria progress: 0/5

**Description:** Wire the user research prompt library (BR-01 to BR-18) into the LLM so AI can ask informed research questions during check-ins.

**Detailed explanation:**

Yair has 18 user research prompts (BR-01 to BR-18) covering specific behavior research questions. These should be available to the AI to ask at appropriate moments — not as a script, but as a library the AI can pull from when context warrants.

SETUP
- Confirm BR-01..BR-18 documented in sheet (likely a Research tab) or /docs/research-prompts.md
- Define when AI is allowed to ask a research question (not during onboarding; during check-ins after some history is built)

BUILD
- Add prompts to a new lookup tool: get_research_prompt(category) → returns 1-3 relevant prompts
- Update system prompt to include 'when appropriate, you may ask the user a research question via get_research_prompt'
- Track in session_log when a research prompt is asked + user's response

VERIFY
- AI asks a research question during a check-in (manual test)
- Question + answer logged to session_log with event_type='research_prompt'

**Acceptance criteria:**

SETUP
□ BR-01..BR-18 documented in canonical location

BUILD
□ get_research_prompt() tool exists in shared module
□ System prompt updated to allow research-question pattern at appropriate moments

VERIFY
□ Test check-in: AI asks at least one research question over 10 sessions
□ session_log shows research_prompt events with question + user response

**Extras:**
- Notes: Source: Asana Brainstorm project. Reference doc maintained in Asana, not duplicated here.

---

### P2-12 — Cross-channel QA (HARD GATE)

**Status:** Not Started · **Priority:** Critical · Weight: 5 · Tier: Backend · Workstream: QA · Assignee: mintesnotm + yonas · Est: 2h · Criteria progress: 0/4

**Description:** Phase 2 HARD GATE: cross-channel QA — same user, same intent, all 3 paths produce consistent coaching response.

**Detailed explanation:**

Mirror of P1-43 but for Phase 2 features (insights, milestones, habit edits). Confirms the 3-path consistency invariant still holds as the surface area grows.

PLAN
- Set up controlled user with seeded session_log + completed habits
- Test 5 scenarios per path (Vapi / Async Reflection / Direct LLM)
- Diff context payloads + response shape across paths

VERIFY
- Same scenario on different paths produces equivalent coaching (same intent, similar wording is fine — same tool calls is required)

**Acceptance criteria:**

PLAN
□ 5 scenarios documented in /docs/test-plans/P2-28.md

VERIFY
□ Tool-call sequences match across paths for each scenario
□ Coaching tone consistent (qualitative review, signed off by Yair)
□ HARD GATE: any drift blocks the Phase 2 release

**Extras:**
- Notes: HARD GATE for Phase 2

---

### P2-13 — GitLab sync improvements (assignee + status labels)

**Status:** Not Started · **Priority:** Low · Weight: 3 · Tier: Both · Workstream: QA · Assignee: alejandro · Criteria progress: 0/6

**Description:** GitLab sync improvements: assignee + status labels mirrored from Master Sheet so GitLab issues match the source of truth.

**Detailed explanation:**

Currently (per cron) Sheet → architecture HTML is one-way and live. GitLab issues drift because manual updates happen in the Sheet but not in GitLab. Goal: extend the sync to keep GitLab issue assignee + status labels in lockstep with the Sheet's Status + Assignee columns.

SETUP
- Confirm GitLab Issue IID column in Sheet has IDs for tasks that have a GitLab issue
- Set up GitLab API access via service token

BUILD
- Extend sync_sheet_to_html.py (or new script) to also update GitLab issues
- For each task with Issue IID: PATCH the issue with current Status (as label) + Assignee (as GitLab user)
- Idempotent: only PATCH if values differ

VERIFY
- Manual sheet edit → within 5 min, GitLab issue reflects new Status + Assignee
- No spurious updates when sheet matches GitLab

**Acceptance criteria:**

SETUP
□ GitLab API token in CI secrets
□ Mapping documented: Sheet status → GitLab label name

BUILD
□ Sync script updates GitLab issues idempotently
□ Last synced column on the Sheet updated per task on each successful PATCH

VERIFY
□ Edit a task's Status in Sheet → within 5 min, GitLab issue label changes
□ Re-run sync with no changes makes zero GitLab API calls

**Extras:**
- Notes: Tooling polish. Alejandro owns. Do FF-34 part early.

---

_Last refreshed: 2026-05-11_