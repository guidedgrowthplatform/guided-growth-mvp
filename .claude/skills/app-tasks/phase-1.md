# Tasks — Phase 1

Source: Google Sheet **Guided Growth OS App Master** · tab `Tasks` · gid `1687604173` · filtered to **Phase 1**.

**Count:** 52 task(s).

## Quick index

| Task ID | Title | Status | Assignee | Est (h) |
|---|---|---|---|---|
| `OLD-P1-01` | Create Supabase Storage Bucket | Done | (prior team) | 0.25 |
| `OLD-P1-02` | Add DB Columns to user_profiles | Done | (prior team) | 0.5 |
| `OLD-P1-03` | Strip ElevenLabs + DeepGram | Done | yonas | 2 |
| `OLD-P1-04` | Configure All Env Variables | Done | (prior team) | 0.5 |
| `OLD-P1-06` | Clone Voice on Cartesia | Done | Yair | 0.5 |
| `OLD-P1-07` | Generate 7 MP3 Files | Done | Yair | 1 |
| `OLD-P1-08` | Upload MP3s to Supabase Storage | Done | (prior team) | 0.25 |
| `OLD-P1-09` | Create voice-manifest.json | Obsolete | mintesnotm | 0.25 |
| `OLD-P1-10` | Build useVoicePlayer Hook | Done | mintesnotm | 1.5 |
| `OLD-P1-13` | Configure Vapi assistant | Done | yonas | 2 |
| `OLD-P1-15` | Deploy Vapi assistant config | Done | yonas | 1 |
| `OLD-P1-19` | Wire MIC-PERMISSION | Obsolete | mintesnotm | 1 |
| `OLD-P1-20` | Wire POST-AUTH-SIGNUP [DEPRECATED] (Welcome) | Obsolete | mintesnotm | 1.5 |
| `OLD-P1-21` | Wire ONBOARD-01 (Profile Setup) | Obsolete | mintesnotm | 3 |
| `OLD-P1-22` | Wire ONBOARD-FORK (Experience Fork) | Obsolete | mintesnotm | 1.5 |
| `OLD-P1-23` | Wire ONBOARD-BEGINNER-01 to ONBOARD-BEGINNER-03 | Obsolete | mintesnotm | 2.5 |
| `OLD-P1-24` | Wire ONBOARD-BEGINNER-04 to ONBOARD-BEGINNER-07 | Obsolete | mintesnotm | 2.5 |
| `OLD-P1-25` | Wire ONBOARD-BEGINNER-10 (Plan Summary + Start) | Obsolete | mintesnotm | 1 |
| `P1-01` | Move CI to GitHub Actions | Done | mintesnotm + alejandro | 1 |
| `P1-02` | Install Vapi SDK + dependencies | In Progress | yonas | 0.25 |
| `P1-03` | Seed Screens + session_log Events into Supabase (Mint priority) | In Progress | mintesnotm | 2 |
| `P1-04` | Build session_log Table + Write API | Not Started | yonas | 2 |
| `P1-05` | Build Context API Endpoint | Not Started | yonas | 1.5 |
| `P1-06` | Add crisis safety rule to base system prompt | Not Started | yonas | 1 |
| `P1-07` | Add Agent Tool Definitions | Not Started | yonas | 1.5 |
| `P1-08` | Extract tool definitions to shared module | Not Started | yonas | 1 |
| `P1-09` | Refactor agent system prompt to support context + delta injection | Not Started | yonas | 1.5 |
| `P1-10` | Build callLLM() Wrapper - THE ENTRY POINT | Not Started | yonas | 3 |
| `P1-11` | Wire Vapi to use shared context builder | Not Started | yonas | 2 |
| `P1-12` | Build VoiceContext Provider | In Progress | mintesnotm | 1 |
| `P1-13` | Extend VoiceContext to track Cartesia session lifecycle | In Progress | said | 1 |
| `P1-14` | Build useRealtimeVoice Hook | Not Started | mintesnotm | 2.5 |
| `P1-15` | Build useLLM hook for direct LLM calls (non-voice path) | Not Started | mintesnotm | 2 |
| `P1-16` | Frontend: useScreenContext + useLLM hooks | Not Started | mintesnotm | 2 |
| `P1-17` | Frontend: Instrument session_log writes | Not Started | mintesnotm | 2 |
| `P1-18` | Build onboarding screen shell | Not Started | mintesnotm | 1 |
| `P1-19` | Wire all 9 onboarding screens to the shell | In Progress | mintesnotm | 1 |
| `P1-20` | Bundle anon_id generation into the auth fix | Not Started | yonas |  |
| `P1-21` | Anonymization MVP - anon_id everywhere downstream | Not Started | yonas | 3 |
| `P1-22` | RLS policy audit (HARD GATE for direct-Supabase access) | Not Started | mintesnotm + yonas |  |
| `P1-23` | Vapi tuning + latency optimization pass | Not Started | yonas |  |
| `P1-24` | Test session_log integrity | Not Started | mintesnotm + yonas | 1 |
| `P1-25` | Test AI Context across all channels (HARD GATE) | Not Started | mintesnotm + yonas | 2.5 |
| `P1-26` | Test cost and latency budget | Not Started | mintesnotm + yonas | 1 |
| `P1-27` | Test Full Happy Path (Voice) | Not Started | mintesnotm + yonas | 2 |
| `P1-28` | Test Full Happy Path (Manual) | Not Started | mintesnotm + yonas | 1.5 |
| `P1-29` | Test Voice-Driven Navigation Edge Cases | Not Started | mintesnotm + yonas | 1.5 |
| `P1-30` | Test Partial/Edge Cases | Not Started | mintesnotm + yonas | 2 |
| `P1-31` | Test crisis safety detection | Not Started | mintesnotm + yonas | 1 |
| `P1-32` | Test on Android APK + Web | Not Started | mintesnotm + yonas | 2 |
| `P1-33` | Document sync architecture decision in callLLM node | Not Started | yonas |  |
| `P1-34` | Team process improvements (Mattermost templates + acceptance criteria) | Not Started | mintesnotm + alejandro |  |

## Tasks

### OLD-P1-01 — Create Supabase Storage Bucket

**Status:** Done · Tier: Backend · Workstream: Infrastructure · Assignee: (prior team) · Est: 0.25h

**Description:** Create public bucket 'voice-assets' in Supabase. Policies: public read for app, service role write for sync script.

**Detailed explanation:**

Create bucket via Supabase dashboard. Set policies via SQL or dashboard UI. Verify by uploading a test MP3 and accessing the public URL.

---

### OLD-P1-02 — Add DB Columns to user_profiles

**Status:** Done · Tier: Backend · Workstream: Infrastructure · Assignee: (prior team) · Est: 0.5h

**Description:** Add ai_output_mode (TEXT DEFAULT 'voice'), mic_permission (BOOLEAN DEFAULT false), voice_mode (TEXT DEFAULT 'voice'). Separate DB migration MR.

**Detailed explanation:**

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ai_output_mode TEXT DEFAULT 'voice', ADD COLUMN IF NOT EXISTS mic_permission BOOLEAN DEFAULT false, ADD COLUMN IF NOT EXISTS voice_mode TEXT DEFAULT 'voice';

---

### OLD-P1-03 — Strip ElevenLabs + DeepGram

**Status:** Done · Tier: Backend · Workstream: Infrastructure · Assignee: yonas · Est: 2h

**Description:** Remove ALL ElevenLabs TTS and DeepGram STT code. Consolidate to Cartesia-only for MVP.

**Detailed explanation:**

Search codebase for elevenlabs, deepgram, eleven, dg-. Remove all imports, package dependencies, env vars. Verify Cartesia is the only voice provider.

---

### OLD-P1-04 — Configure All Env Variables

**Status:** Done · Tier: Backend · Workstream: Infrastructure · Assignee: (prior team) · Est: 0.5h

**Description:** CARTESIA_API_KEY, CARTESIA_VOICE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY (for direct LLM path), VITE_ client vars.

**Detailed explanation:**

Set on local .env, Vercel preview, Vercel production, GitLab CI. Document in README. Never commit .env to repo.

---

### OLD-P1-06 — Clone Voice on Cartesia

**Status:** Done · Tier: Backend · Workstream: Voice · Assignee: Yair · Est: 0.5h

**Description:** Go to cartesia.ai > Voices > Create Voice. Upload 30-60 sec voice sample. Copy voice_id.

**Detailed explanation:**

Recorded 60s sample in quiet room. Uploaded to Cartesia. Saved voice_id in CARTESIA_VOICE_ID env var.

---

### OLD-P1-07 — Generate 7 MP3 Files

**Status:** Done · Tier: Frontend · Workstream: Voice · Assignee: Yair · Est: 1h

**Description:** Use Cartesia playground or API. Generate all 7 files from the MP3 Files tab text.

**Detailed explanation:**

All 7 files generated and listened-back for quality. See MP3 Files tab for filenames, screens, and current Supabase URLs.

**Extras:**
- Notes: [v2 update] Obsolete - no MP3s in MVP onboarding (all-Vapi)

---

### OLD-P1-08 — Upload MP3s to Supabase Storage

**Status:** Done · Tier: Backend · Workstream: Voice · Assignee: (prior team) · Est: 0.25h

**Description:** Upload all 7 files to voice-assets bucket. Record the public URLs in the MP3 Files tab.

**Detailed explanation:**

Upload via Supabase dashboard or CLI. Record each public URL in the MP3 Files tab.

**Extras:**
- Notes: [v2 update] Obsolete - no MP3s in MVP onboarding (all-Vapi)

---

### OLD-P1-09 — Create voice-manifest.json

**Status:** Obsolete · Tier: Frontend · Workstream: Voice · Assignee: mintesnotm · Est: 0.25h

**Description:** Map all 7 file IDs to their Supabase Storage URLs + text. Used by useVoicePlayer hook.

**Detailed explanation:**

Create src/lib/voice-manifest.json with structure: { 'splash_hook': { url, text, duration_sec }, ... }. Reference from useVoicePlayer hook.

**Extras:**
- Notes: [v2 update] Obsolete - no MP3s in MVP onboarding (all-Vapi). May rebuild in Stage 5 for check-in MP3s.

---

### OLD-P1-10 — Build useVoicePlayer Hook

**Status:** Done · Tier: Frontend · Workstream: Voice · Assignee: mintesnotm · Est: 1.5h

**Description:** React hook for MP3 playback. No LLM involvement - pure playback. Mutual exclusion via VoiceContext.

**Detailed explanation:**

Hook signature: useVoicePlayer(). Methods: play(file_id), stop(), pause(), resume(). Returns: { isPlaying, currentFile, error }. Pulls URLs from voice-manifest.json. Cleanup on unmount.

**Extras:**
- Notes: [v2 update] Code stays in repo. Not used in MVP onboarding. May reactivate in Stage 5 for check-in MP3 playback.

---

### OLD-P1-13 — Configure Vapi assistant

**Status:** Done · Tier: Backend · Workstream: Voice · Assignee: yonas · Est: 2h

**Description:** Configure the Vapi assistant (system prompt, LLM, voice, first message, tools) via the Vapi dashboard.

**Detailed explanation:**

The Vapi assistant config is the runtime that all onboarding voice screens connect to. Configure it once in the Vapi dashboard, then version-control the JSON in our repo as a backup.

SETUP
- Pull system prompt from sheet's Global Context tab
- Confirm LLM (GPT-4o mini), STT (Soniox), TTS (Cartesia Sonic 3.5 + Yair's voice_id)

BUILD
- In Vapi dashboard: create assistant, paste system prompt, wire LLM/STT/TTS, set first_message generation strategy, attach tools (P1-14)
- Export assistant config JSON, commit to repo at config/vapi-assistant.json

VERIFY
- Assistant accepts WebSocket connections from frontend
- A 30s test call exercises the system prompt + at least one tool call

**Acceptance criteria:**

SETUP
□ Cartesia voice_id matches Yair's clone (verified by ear)
□ Global Context system prompt is current

BUILD
□ Vapi dashboard shows assistant in published state
□ config/vapi-assistant.json checked into repo at HEAD

VERIFY
□ Frontend can connect to assistant via WebSocket
□ Test call: greeting plays, user speaks, AI responds, ≥1 tool call fires

**Extras:**
- Notes: [RESET 2026-05-05: was marked Done for Cartesia Line era. Reset to Not Started for Vapi pivot work.]
- Yonas: Just to clarify the architecture direction: are we planning to use Vapi with its default managed providers, or are we explicitly using BYOK/provider integrations (OpenAI, Cartesia, etc.)?
I’m asking because the latest spec mentions “gpt-4o-mini via your OpenAI key” and “Cartesia Sonic-3 with cloned voice_id,” which sounds like we’ll need separate provider accounts/API keys in addition to the Vapi account.


---

### OLD-P1-15 — Deploy Vapi assistant config

**Status:** Done · Tier: Backend · Workstream: Infrastructure · Assignee: yonas · Est: 1h

**Description:** Push the configured Vapi assistant (P1-13 + tools P1-14) to the Vapi platform and verify the runtime endpoint accepts connections.

**Detailed explanation:**

Final deploy step for the Vapi assistant. The dashboard config + tool schema must land in production so frontend WebSocket connections from useRealtimeVoice (P1-16) can reach it.

SETUP
- Confirm P1-13 (assistant config) + P1-14 (tool defs) are checked in
- Confirm production env vars are set (Vapi PROD account, not staging)

BUILD
- Push assistant config to Vapi production via dashboard or API
- Verify tools are attached and visible in dashboard

VERIFY
- WebSocket connection from a smoke-test frontend completes
- Simple voice round-trip: mic → STT → LLM → TTS → speaker, all under 2s end-to-end

**Acceptance criteria:**

SETUP
□ Assistant ID logged in repo's /config/README.md

BUILD
□ Vapi dashboard shows the assistant deployed and active in PROD
□ All 4 tools (P1-14) are attached and listed in dashboard

VERIFY
□ Smoke-test: frontend connects via WebSocket, no TLS or CORS errors
□ One full voice turn completes in <2s p95 over 5 trials

**Extras:**
- Notes: [RESET 2026-05-05: was In Progress for Cartesia Line era. Reset to Not Started for Vapi pivot work.]

---

### OLD-P1-19 — Wire MIC-PERMISSION

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1h

**Description:** Wire MIC-PERMISSION (mic permission ask) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the MIC-PERMISSION screen (mic permission ask). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when permission resolves.

Voice path: Vapi assistant speaks pre-permission explanation (~8 sec); button triggers browser getUserMedia(); Vapi confirms granted or reassures denied; save user_profile.mic_permission

SETUP
- Create src/screens/MIC-PERMISSION.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("MIC-PERMISSION") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/MIC-PERMISSION.tsx exists, mounted at the right route
□ AI context block for MIC-PERMISSION present in screen_contexts table

BUILD
□ UI matches Figma frame for MIC-PERMISSION
□ useScreenContext("MIC-PERMISSION") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### OLD-P1-20 — Wire POST-AUTH-SIGNUP [DEPRECATED] (Welcome)

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1.5h

**Description:** Wire POST-AUTH-SIGNUP [DEPRECATED] (welcome + trust-building (~85 sec total)) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the POST-AUTH-SIGNUP [DEPRECATED] screen (welcome + trust-building (~85 sec total)). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when user taps 'I'm ready'.

Voice path: ALL-Vapi live TTS; welcome speech (~60s) covers what the app is + anonymization promise; then separate Vapi session for presence ask (~25s)

SETUP
- Create src/screens/POST-AUTH-SIGNUP [DEPRECATED].tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("POST-AUTH-SIGNUP [DEPRECATED]") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/POST-AUTH-SIGNUP [DEPRECATED].tsx exists, mounted at the right route
□ AI context block for POST-AUTH-SIGNUP [DEPRECATED] present in screen_contexts table

BUILD
□ UI matches Figma frame for POST-AUTH-SIGNUP [DEPRECATED]
□ useScreenContext("POST-AUTH-SIGNUP [DEPRECATED]") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### OLD-P1-21 — Wire ONBOARD-01 (Profile Setup)

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 3h

**Description:** Wire ONBOARD-01 (profile setup (name, age, focus)) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the ONBOARD-01 screen (profile setup (name, age, focus)). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when all required profile fields collected.

Voice path: Vapi conversational — assistant asks each profile field, user answers in voice or types; assistant calls update_profile() per field

SETUP
- Create src/screens/ONBOARD-01.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("ONBOARD-01") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/ONBOARD-01.tsx exists, mounted at the right route
□ AI context block for ONBOARD-01 present in screen_contexts table

BUILD
□ UI matches Figma frame for ONBOARD-01
□ useScreenContext("ONBOARD-01") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

Critical first integration of v6.0 LLM-centric architecture.

---

### OLD-P1-22 — Wire ONBOARD-FORK (Experience Fork)

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1.5h

**Description:** Wire ONBOARD-FORK (habit selection from suggested list) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the ONBOARD-FORK screen (habit selection from suggested list). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when user confirms a habit set.

Voice path: Vapi presents 3-5 habits relevant to user's focus area; user picks via voice or tap; assistant calls update_profile(habits) and navigate_next

SETUP
- Create src/screens/ONBOARD-FORK.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("ONBOARD-FORK") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/ONBOARD-FORK.tsx exists, mounted at the right route
□ AI context block for ONBOARD-FORK present in screen_contexts table

BUILD
□ UI matches Figma frame for ONBOARD-FORK
□ useScreenContext("ONBOARD-FORK") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### OLD-P1-23 — Wire ONBOARD-BEGINNER-01 to ONBOARD-BEGINNER-03

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 2.5h

**Description:** Wire ONBOARD-BEGINNER-01 (habit difficulty calibration) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the ONBOARD-BEGINNER-01 screen (habit difficulty calibration). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when all habits have cadence set.

Voice path: Vapi asks 'how often do you want to do X?' per habit; user adjusts via voice; assistant updates habit cadence

SETUP
- Create src/screens/ONBOARD-BEGINNER-01.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("ONBOARD-BEGINNER-01") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/ONBOARD-BEGINNER-01.tsx exists, mounted at the right route
□ AI context block for ONBOARD-BEGINNER-01 present in screen_contexts table

BUILD
□ UI matches Figma frame for ONBOARD-BEGINNER-01
□ useScreenContext("ONBOARD-BEGINNER-01") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### OLD-P1-24 — Wire ONBOARD-BEGINNER-04 to ONBOARD-BEGINNER-07

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 2.5h

**Description:** Wire ONBOARD-BEGINNER-02 (first commitment + accountability framing) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the ONBOARD-BEGINNER-02 screen (first commitment + accountability framing). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when user verbalizes commitment.

Voice path: Vapi explains the daily check-in concept; user verbally commits; assistant logs commitment event to session_log

SETUP
- Create src/screens/ONBOARD-BEGINNER-02.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("ONBOARD-BEGINNER-02") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/ONBOARD-BEGINNER-02.tsx exists, mounted at the right route
□ AI context block for ONBOARD-BEGINNER-02 present in screen_contexts table

BUILD
□ UI matches Figma frame for ONBOARD-BEGINNER-02
□ useScreenContext("ONBOARD-BEGINNER-02") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### OLD-P1-25 — Wire ONBOARD-BEGINNER-10 (Plan Summary + Start)

**Status:** Obsolete · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1h

**Description:** Wire ONBOARD-BEGINNER-03 (wrap + first check-in scheduling) into the app: voice + text inputs, screen context, navigation.

**Detailed explanation:**

Implements the ONBOARD-BEGINNER-03 screen (wrap + first check-in scheduling). User can input via voice (Vapi) or tap/text. Screen reads its AI context block from screen_contexts (P1-31) and advances when user confirms schedule.

Voice path: Vapi confirms profile + habits, asks when user wants the first check-in nudge; assistant calls update_profile(first_checkin_at) and navigate_next to HOME-FIRST

SETUP
- Create src/screens/ONBOARD-BEGINNER-03.tsx
- Wrap in <VoiceProvider> via root layout (P1-11 dep)
- Confirm screen's AI context block exists in Screens tab + seeded to DB

BUILD
- Render UI per Figma frame
- Wire useScreenContext("ONBOARD-BEGINNER-03") for AI context
- Wire useVoiceContext() to detect input modality
- Hook navigate_next tool call to advance

VERIFY
- Voice path: complete the screen using mic only
- Text/tap path: same, with no voice
- Navigation fires only on the documented trigger

**Acceptance criteria:**

SETUP
□ src/screens/ONBOARD-BEGINNER-03.tsx exists, mounted at the right route
□ AI context block for ONBOARD-BEGINNER-03 present in screen_contexts table

BUILD
□ UI matches Figma frame for ONBOARD-BEGINNER-03
□ useScreenContext("ONBOARD-BEGINNER-03") returns expected context

VERIFY
□ Voice-only end-to-end: speak the trigger → AI responds → screen advances
□ Tap-only fallback works identically
□ No console errors during full flow

**Extras:**
- Notes: Consolidated into P1-17 (shell) + P1-18 (per-screen wiring) on 2026-05-08 per Yair's review — 9 wire tasks were redundant once Vapi handles orchestration.

---

### P1-01 — Move CI to GitHub Actions

**Status:** Done · **Priority:** Medium · Weight: 1 · Tier: Both · Workstream: Infrastructure · Assignee: mintesnotm + alejandro · Est: 1h · Criteria progress: 1/7

**Description:** Migrate CI/CD from GitLab Runners (quota exhausted) to GitHub Actions (unlimited minutes for public repos).

**Detailed explanation:**

GitLab free-tier runner minutes are gone; CI is blocked. Move workflow to GitHub Actions, which is free + unmetered for public repos. The GitLab repo already mirrors to a public GitHub repo, so jobs run there.

SETUP
- Audit .gitlab-ci.yml to enumerate every job (lint / test / build / deploy)
- Verify GitHub repo mirror is up to date

BUILD
- Translate each GitLab job to GitHub Actions YAML in .github/workflows/ci.yml
- Add caching for node_modules and build outputs
- Mirror all required secrets into GitHub repo settings

VERIFY
- Push to main triggers the workflow; all jobs pass
- Run in parallel with GitLab CI for one week before disabling GitLab

**Acceptance criteria:**

SETUP
□ .github/workflows/ci.yml exists with one job per GitLab job
□ All required secrets present in GitHub repo settings

BUILD
□ Workflow triggers on push + PR to main
□ Cache hit reduces re-run time by >40%

VERIFY
□ Test push: every job conclusion=success on GitHub
□ Deploy step produces an artifact identical to GitLab's
□ One week of parallel runs shows zero GitHub-only failures

**Extras:**
- Notes: Pending - need to confirm GitLab quota status and whether mirroring is actually needed. [BACKLOG PRIORITY 2026-05-05: Stage 4 work but not blocking MVP launch.]

---

### P1-02 — Install Vapi SDK + dependencies

**Status:** In Progress · **Priority:** High · Weight: 1 · Tier: Backend · Workstream: Infrastructure · Assignee: yonas · Est: 0.25h · Criteria progress: 0/7

**Description:** Install Vapi SDKs (frontend + optional server) so the rest of the team can wire Vapi into the app.

**Detailed explanation:**

Vapi orchestrates the onboarding voice flow: STT (Soniox) → LLM (GPT-4o mini) → TTS (Cartesia Sonic 3.5 with Yair's cloned voice). The web SDK is what the frontend imports; server SDK is optional (most config lives in the Vapi dashboard).

SETUP
- Confirm package versions: @vapi-ai/web (latest stable)
- Add CARTESIA_API_KEY, OPENAI_API_KEY, VAPI_PUBLIC_KEY env vars (P1-04 dep)

BUILD
- npm install @vapi-ai/web in the frontend repo
- Optionally install @vapi-ai/server-sdk in the backend if dashboard config isn't enough

VERIFY
- Hello-world Vapi voice session runs from the dashboard
- Cartesia voice provider responds with cloned voice

**Acceptance criteria:**

SETUP
□ VAPI_PUBLIC_KEY present in .env.local AND in CI secrets
□ Cartesia + OpenAI keys confirmed present in Vapi dashboard (sanity)
□ @vapi-ai/web appears in frontend package.json with pinned version

BUILD
□ npm install completes; lockfile updated
□ Import in a smoke-test component compiles without TS errors

VERIFY
□ Vapi dashboard hello-world session uses Yair'''s cloned voice
□ Round-trip (mic → STT → LLM → TTS → speaker) works end-to-end

**Extras:**
- Notes: [RESET 2026-05-05: was marked Done for Cartesia Line era. Reset to Not Started for Vapi pivot work.]

---

### P1-03 — Seed Screens + session_log Events into Supabase (Mint priority)

**Status:** In Progress · **Priority:** Critical · Weight: 5 · Tier: Backend · Workstream: LLM · Assignee: mintesnotm · Est: 2h · Criteria progress: 0/13

**Description:** [PRIORITY 1 for Mint] Recurring Sheet → Supabase sync. TWO targets: Screens tab → screen_contexts table; session_log Events tab → session_log table. Global Context is NOT synced — it lives inside the Vapi system prompt.

**Detailed explanation:**

Foundational sync. Every LLM-active screen depends on screen_contexts being populated; the LLM reads it on every callLLM(). Owned by Mint per the May 7 call.

TWO SYNC TARGETS

1. Per-screen context — Screens tab → screen_contexts table
   Includes voice instructions, expected user response, AI response, system action, edge cases, notes, MP3 yes/no — all the per-screen content. (Yair confirmed on May 7 call: "all that should be in the context one".)

2. session_log event taxonomy — session_log Events tab → session_log table (or events_taxonomy)
   Defines the canonical event types our app will write at runtime. Sheet is the source of truth for event names + payload shapes. Backend uses this for validation when writing events.

EXPLICITLY NOT SYNCED

- Global Context — lives inside the Vapi system prompt itself (configured at the Vapi assistant level). No separate Supabase table needed for MVP. The Vapi assistant config is the source of truth for global context; updates to it happen in the Vapi dashboard or via Vapi config JSON in the repo.

SETUP
- Receive service-account JSON from Yair via Mattermost
- Place at backend secret store (env or vault)
- Read existing scripts/sync_sheet_to_html.py for the pattern (cron + Sheets API + retry)

BUILD
- scripts/seed_contexts.py — reads Screens tab, idempotent upsert to screen_contexts (hash-based change detection so unchanged rows are no-ops)
- scripts/seed_session_log_events.py — reads session_log Events tab, upserts to session_log table (or a separate events_taxonomy table — Mint to decide based on schema fit)
- Cloudflare Worker cron (mirror of gg-arch-cron pattern): every 1 min, POSTs workflow_dispatch to backend repo workflow that runs both scripts
- Both scripts retry on Sheets 5xx (mirror of sync_sheet_to_html.py _with_retry)

VERIFY
- Edit a screen context in the sheet → within 1 min, screen_contexts table shows the new value
- Edit an event taxonomy row → within 1 min, target table reflects it
- Sync runs that find no diff exit 0 with "no changes" log line — no spurious DB writes

**Acceptance criteria:**

SETUP
□ Service-account JSON received and stored in backend secret store
□ Both target tables exist in Supabase: screen_contexts, session_log (or events_taxonomy if Mint decides)

BUILD
□ scripts/seed_contexts.py exists, runs end-to-end against the live sheet
□ scripts/seed_session_log_events.py exists, runs end-to-end
□ Both scripts are idempotent: re-running with no sheet changes makes zero DB writes
□ Both scripts have retry-with-backoff on Sheets 5xx
□ Cloudflare Worker cron deployed firing every 1 min, triggering the backend workflow

VERIFY
□ Edit a row in Screens tab → within 1 min, SELECT screen_contexts shows the new value
□ Edit a row in session_log Events tab → within 1 min, target table reflects it
□ Run sync against unchanged sheet → log shows "no changes", DB unchanged
□ Sync run conclusion=success on the actual cron schedule for 24 hours straight (no failure emails)
□ Service account stays read-only (Viewer on the Sheet — no write needed for this direction)
□ Global Context tab is NOT touched by either script (verified by code review)

**Extras:**
- Notes: NEW core task in v6.0

---

### P1-04 — Build session_log Table + Write API

**Status:** Not Started · **Priority:** High · Weight: 3 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 2h · Criteria progress: 0/7

**Description:** Build session_log table (event stream) + POST /api/session_log endpoint. THE STATE DELTA SOURCE for callLLM.

**Detailed explanation:**

Append-only event stream — every meaningful user action becomes a row. callLLM() reads recent rows to catch up on state since the last LLM turn. Foundation for the 'caught-up' principle: the LLM never has to ask "what just happened?".

Schema:
- id (uuid pk), anon_id (uuid fk), session_id (uuid), timestamp (timestamptz), event_type (text), screen_id (text), payload (jsonb)

SETUP
- Define migration in scripts/db/ or supabase/migrations/

BUILD
- CREATE TABLE session_log with the schema above + indexes on (anon_id, timestamp DESC)
- RLS: append-only for the row's anon_id; no cross-user reads
- POST /api/session_log endpoint: validates anon_id ownership, writes row
- Keyed on anon_id (NOT auth user_id) per P1-46

VERIFY
- Endpoint accepts a write, returns 200 with row id
- Query session_log by anon_id ordered by timestamp returns recent rows fast

**Acceptance criteria:**

SETUP
□ Migration file checked in and applied

BUILD
□ Table exists with all 7 columns + index on (anon_id, timestamp DESC)
□ RLS policy denies SELECT/INSERT for anon_ids other than the caller's
□ POST /api/session_log validates anon_id and returns 200 + row id

VERIFY
□ 1000-row insert completes in <2s
□ Query "last 50 events for anon_id X" returns in <50ms
□ Cross-user read attempt (forged anon_id) returns 403

**Extras:**
- Notes: NEW core task in v6.0. Critical: this is the data source for state delta.

---

### P1-05 — Build Context API Endpoint

**Status:** Not Started · **Priority:** High · Weight: 2 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1.5h · Criteria progress: 0/6

**Description:** Build GET /api/context endpoint — returns the per-screen context block + state delta for callLLM.

**Detailed explanation:**

The data feed for callLLM. Frontend hits this endpoint with the current screen + last-seen timestamp; backend returns the context block (P1-31 seed) and any session_log events since then.

Endpoint shape:
GET /api/context?screen_id=X&anon_id=Y&since_ts=Z
Returns: { screen_id, context_block, version, state_delta: [...] }

SETUP
- Confirm screen_contexts table populated (P1-31)
- Confirm session_log table exists (P1-32)

BUILD
- Implement endpoint in backend
- Cache context_block for 60s per (screen_id, version) — content rarely changes
- state_delta always fresh: SELECT from session_log WHERE anon_id=Y AND timestamp > since_ts

VERIFY
- A request for an active screen returns full context block + recent events
- Cache hit ratio >80% under typical onboarding traffic

**Acceptance criteria:**

SETUP
□ /api/context route exists in backend router

BUILD
□ Returns 200 with the documented JSON shape for valid requests
□ Returns 404 for unknown screen_id, 401 for missing anon_id
□ Cache implemented (verified by repeated identical requests showing same version)

VERIFY
□ p50 latency <80ms, p99 <250ms over 1k synthetic requests
□ Stale cache invalidates within 60s of a sheet → DB sync

**Extras:**
- Notes: NEW core task in v6.0

---

### P1-06 — Add crisis safety rule to base system prompt

**Status:** Not Started · **Priority:** High · Weight: 1 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1h · Criteria progress: 0/5

**Description:** FALSE

**Detailed explanation:**

Once P1-46 lands, all 3 LLM paths and PostHog must use anon_id consistently. This task documents the contract so new code doesn't drift back to using user_id for behavior.

SETUP
- Confirm P1-46 migration applied

BUILD
- Write /docs/anon-id-contract.md covering: scope, do's, don'ts, how to add a new behavioral table
- Update Vapi assistant config (P1-13) to pass anon_id (not user_id) in tool calls
- Update PostHog identify() calls to use anon_id

VERIFY
- Any new code touching behavioral data references anon_id
- PostHog dashboard shows users keyed on anon_id

**Acceptance criteria:**

SETUP
□ /docs/anon-id-contract.md exists and is linked from /docs/README.md

BUILD
□ Vapi assistant config tool calls pass anon_id, not user_id
□ PostHog identify() uses anon_id

VERIFY
□ Code review checklist updated to flag user_id usage in behavioral context
□ PostHog dashboard sample event: distinct_id = anon_id

**Extras:**
- Notes: Stage 4. One source of truth. Applies across Cartesia and direct LLM via callLLM().

---

### P1-07 — Add Agent Tool Definitions

**Status:** Not Started · **Priority:** High · Weight: 2 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1.5h · Criteria progress: 0/5

**Description:** Define the LLM tool schema (get_user_context, update_profile, navigate_next, log_event) in a shared module that both Vapi and Direct LLM paths import.

**Detailed explanation:**

Tools are the LLM's hands. Both Vapi (Path 1) and Direct LLM (Path 3) need identical tool signatures so behavior is consistent across channels. Defining once prevents drift.

SETUP
- Create shared backend module src/llm/tools.ts (or .py if backend stays Python)

BUILD
- Define 4 tools with JSON schema:
  • get_user_context() → returns {profile, habits, recent_checkins}
  • update_profile(field, value) → writes user-volunteered data
  • navigate_next(target_screen) → voice-driven navigation
  • log_event(event_name, properties) → writes to session_log + PostHog
- Each tool calls existing backend API (no duplicated business logic)

VERIFY
- Vapi assistant config (P1-13) imports from this module
- Direct LLM path (P1-38) imports from this module
- Both produce identical tool-call requests for identical inputs

**Acceptance criteria:**

SETUP
□ src/llm/tools.ts (or equivalent) exists in shared module path

BUILD
□ All 4 tools defined with strict JSON schema matching docs
□ Each tool delegates to existing backend API endpoints, no logic duplicated

VERIFY
□ Vapi config and Direct LLM both import from this module — single source
□ Same input on both paths produces identical tool_call payload (diff = empty)

**Extras:**
- Notes: [RESET 2026-05-05: was marked Done for Cartesia Line era. Reset to Not Started for Vapi pivot work.]

---

### P1-08 — Extract tool definitions to shared module

**Status:** Not Started · **Priority:** Medium · Weight: 1 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1h · Criteria progress: 0/5

**Description:** Move existing tool definitions out of the legacy agent code into the shared module from P1-14.

**Detailed explanation:**

Predecessor task to clean up the codebase. The old Cartesia Line agent code had its own tool definitions; those need to migrate to the shared module so we have one source of truth.

SETUP
- Inventory tool definitions in legacy agent code (likely in /agent/tools.py)
- Diff against P1-14's new shared module

BUILD
- Migrate each tool to src/llm/tools.ts
- Delete the legacy duplicate definitions
- Update legacy code's imports to reference the shared module

VERIFY
- Legacy code still compiles and runs (during the brief overlap window)
- No tool is defined in two places

**Acceptance criteria:**

SETUP
□ Inventory committed as /docs/legacy-tools-audit.md

BUILD
□ All legacy tool defs deleted from /agent/tools.py (or equivalent)
□ Legacy code imports the shared module instead

VERIFY
□ grep -r "def.*_tool\|export.*Tool" returns hits only in src/llm/tools.ts
□ Existing legacy tests still pass

**Extras:**
- Notes: PENDING YONAS VERIFICATION.

---

### P1-09 — Refactor agent system prompt to support context + delta injection

**Status:** Not Started · **Priority:** Medium · Weight: 2 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 1.5h · Criteria progress: 0/4

**Description:** Refactor Vapi assistant system prompt to accept BASE_PROMPT + screen_contexts + state_delta + user_input — same shape as Path 2/3.

**Detailed explanation:**

All 3 paths (Vapi / Async Reflection / Direct LLM) need to consume the SAME context structure so coaching is consistent across channels. Today the Vapi prompt is bespoke; this task aligns it.

SETUP
- Document the canonical 4-block context shape (BASE_PROMPT + screen_contexts + state_delta + user_input)
- Identify which Vapi config field each block maps to

BUILD
- Update Vapi assistant system prompt template to slot in the 4 blocks
- Wire P1-42 context builder so Vapi pulls the same context Path 2/3 do

VERIFY
- A test interaction generates context that matches what Path 3 (Direct LLM) generates for the same screen+user state

**Acceptance criteria:**

SETUP
□ Canonical 4-block shape documented in /docs/llm-context.md

BUILD
□ Vapi system prompt template references all 4 blocks by placeholder
□ context builder (P1-42) returns the same shape Path 3 consumes

VERIFY
□ Same screen + same user state → Vapi and Direct LLM see identical context blocks (diff is empty)

**Extras:**
- Notes: PENDING YONAS VERIFICATION: if his current prompt structure already has placeholders, this task gets deleted.
- Yonas: I’m a bit confused about the orchestration responsibilities here.
The first task mentions modifying Cartesia’s `before_llm_call` hook, which suggests Cartesia is handling the LLM flow. But the follow-up task mentions modifying the Vapi assistant config/proxy backend to inject runtime context before each LLM call, which suggests Vapi is the orchestrator instead.
Since Cartesia is planned for STT/TTS, I just wanted clarification on which layer is actually responsible for LLM orchestration and prompt injection.


---

### P1-10 — Build callLLM() Wrapper - THE ENTRY POINT

**Status:** Not Started · **Priority:** Critical · Weight: 5 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 3h · Criteria progress: 0/6

**Description:** Build callLLM() — the SINGLE entry point that routes to Vapi / Async Reflection / Direct LLM based on screen + session state.

**Detailed explanation:**

The brain of the LLM layer. Frontend never picks a path directly — it always calls callLLM() and the wrapper decides:
- Vapi (Path 1) if onboarding voice session is active for this user
- Async Reflection (Path 2) if on a check-in screen
- Direct LLM (Path 3) otherwise

Pseudo-code lives in the Architecture tab.

SETUP
- Read VoiceContext.vapiSessionActive (P1-39 dep)
- Read screen_id from useScreenContext (P1-41 dep)

BUILD
- Implement callLLM({user_input, screen_id, anon_id}) in shared backend module
- Routing logic: if vapi_session_active → Path 1; if screen in CHECKIN_SCREENS → Path 2; else Path 3
- Provider-agnostic: Path 3 LLM choice (GPT-4o mini, Gemini Flash, etc.) is a config swap

VERIFY
- Same input on Path 3 returns deterministic-ish response
- Routing decision logged to session_log for debugging

**Acceptance criteria:**

SETUP
□ CHECKIN_SCREENS list defined in shared module

BUILD
□ callLLM() exists in shared backend module
□ Routing matches the 3-rule spec exactly (verified by unit test per branch)
□ Provider is swappable via env var (proven by test with mock LLM)

VERIFY
□ Smoke test: 1 invocation per path returns the expected response shape
□ Routing decision visible in session_log within 1s of the call

**Extras:**
- Notes: NEW core task in v6.0. SINGLE ENTRY POINT - no exceptions.

---

### P1-11 — Wire Vapi to use shared context builder

**Status:** Not Started · **Priority:** High · Weight: 3 · Tier: Backend · Workstream: LLM · Assignee: yonas · Est: 2h · Criteria progress: 0/6

**Description:** Refactor Vapi assistant to pull context via the SAME shared context builder that Path 2/3 use, so all paths see identical context.

**Detailed explanation:**

Today the Vapi assistant has a hardcoded system prompt with no per-call context. To get consistent coaching across all 3 paths, Vapi must pull context dynamically — same source as P1-33 / Path 2 / Path 3.

SETUP
- Define what 'context builder' means: a backend function that returns {context_block, state_delta, user_profile} for (screen_id, anon_id, since_ts)
- Identify which Vapi config field accepts dynamic context (likely a webhook before_llm_call)

BUILD
- Implement before_llm_call hook in Vapi assistant config (P1-13)
- Hook calls our backend's context endpoint, formats response into Vapi's expected shape
- Same response feeds Path 3 (P1-33), proven by a unit test that diffs the output

VERIFY
- A Vapi voice session and a Direct LLM call on the same screen + same user state see byte-identical context

**Acceptance criteria:**

SETUP
□ Context builder function exists in shared backend module

BUILD
□ Vapi assistant config has before_llm_call webhook pointing at our endpoint
□ Webhook returns within 200ms p99 (so it doesn't block voice latency)
□ Same backend function feeds Path 1 (Vapi) and Path 3 (/api/llm)

VERIFY
□ Diff test: Vapi context payload vs Direct LLM context payload for same (screen, user) → empty
□ Onboarding test session uses fresh per-call context (verified in Vapi logs)

**Extras:**
- Notes: PENDING YONAS VERIFICATION: depends on Vapi supporting mid-session prompt updates - confirm via docs.cartesia.ai/line.

---

### P1-12 — Build VoiceContext Provider

**Status:** In Progress · **Priority:** High · Weight: 2 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm · Est: 1h · Criteria progress: 0/8

**Description:** React Context provider holding voice state (ai_output_mode, mic_permission, Vapi session) that wraps every LLM-active screen.

**Detailed explanation:**

Single source of truth for voice state across the app. Eliminates prop-drilling between WELCOME, VOICE-PREFERENCE, MIC-PERMISSION, and all subsequent LLM-active screens.

State shape:
- ai_output_mode: 'voice' | 'screen'
- mic_permission: 'granted' | 'denied' | 'pending'
- vapiSessionActive: boolean
- currentVoicePath: string (which screen owns the active voice path)

SETUP
- Create src/contexts/VoiceContext.tsx with strict TypeScript types
- Define initial state defaults that match VOICE-PREFERENCE's first-mount expectations

BUILD
- Implement <VoiceProvider> with useReducer + named action creators
- Export useVoiceContext() hook with discriminated unions
- Wrap RootLayout in <VoiceProvider> at app/layout.tsx

VERIFY
- All LLM-active screens consume context — no prop-drilling remains
- mic_permission toggle propagates within 100ms across mounted screens

**Acceptance criteria:**

SETUP
□ src/contexts/VoiceContext.tsx exports VoiceProvider + useVoiceContext
□ Compiles under tsconfig strict mode with no any

BUILD
□ Reducer covers all 4 action types and rejects invalid transitions
□ <VoiceProvider> wraps app/layout.tsx at root
□ Default state on first mount matches what VOICE-PREFERENCE reads

VERIFY
□ console.log(useVoiceContext()) on WELCOME prints all 4 fields
□ Dev mic-toggle → MIC-PERMISSION re-renders with new permission in <100ms
□ Removing provider in dev breaks WELCOME (proves wrap is real)

---

### P1-13 — Extend VoiceContext to track Cartesia session lifecycle

**Status:** In Progress · **Priority:** High · Weight: 2 · Tier: Frontend · Workstream: LLM · Assignee: said · Est: 1h · Criteria progress: 0/6

**Description:** Extend VoiceContext (P1-11) with vapiSessionActive boolean so callLLM() can route to the right voice path.

**Detailed explanation:**

FOLLOW-UP on P1-11. The callLLM() wrapper (P1-34) needs to know whether a Vapi onboarding session is currently live, so it can choose the right path:
- Vapi if onboarding voice session is active
- Async Reflection if on a check-in screen
- Direct LLM otherwise

SETUP
- Read P1-11's VoiceContext shape; identify where vapiSessionActive belongs

BUILD
- Add vapiSessionActive: boolean to VoiceContextValue
- Set true on Vapi session start (useRealtimeVoice), false on session end OR navigation away
- Add cleanup effect so we don't burn Vapi minutes after a screen unmounts

VERIFY
- callLLM() reads the flag correctly across all 3 paths
- Navigation cleanup confirmed by Vapi billing showing no leaked sessions

**Acceptance criteria:**

SETUP
□ Type VoiceContextValue includes vapiSessionActive: boolean

BUILD
□ Flag flips to true when useRealtimeVoice opens a Vapi session
□ Flag flips to false on session end OR component unmount (whichever first)
□ Cleanup effect cancels any in-flight Vapi connection on unmount

VERIFY
□ callLLM() routes to Vapi when flag is true (verified via integration test)
□ Forced navigation mid-session: Vapi billing shows no minutes leaked beyond unmount

**Extras:**
- Notes: PENDING YONAS VERIFICATION - if his current implementation already supports this, this task gets deleted.

---

### P1-14 — Build useRealtimeVoice Hook

**Status:** Not Started · **Priority:** High · Weight: 3 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm · Est: 2.5h · Criteria progress: 0/6

**Description:** React hook (useRealtimeVoice) that manages a Vapi session lifecycle from the frontend: open WS, stream mic, play replies, handle interruptions, clean up on navigate.

**Detailed explanation:**

Frontend's interface to Vapi. Used exclusively by the Vapi (Path 1) onboarding screens — check-ins use useAsyncReflection, Direct LLM uses useLLM.

SETUP
- Read Vapi @vapi-ai/web docs for connection lifecycle + interruption handling
- Confirm useVoiceContext (P1-11) provides the mic_permission state we'll gate on

BUILD
- Implement useRealtimeVoice() returning {start, stop, isListening, isSpeaking, error}
- Open WS on start, stream mic via getUserMedia, play TTS audio chunks as they arrive
- Set vapiSessionActive in VoiceContext while session is live
- Handle interruption: user speaks while AI is talking → AI yields

VERIFY
- Open onboarding screen → start() works first try
- Navigate away mid-session → session closes cleanly, no leaked WS

**Acceptance criteria:**

SETUP
□ Hook signature documented in /docs/hooks.md

BUILD
□ start() opens WS and gets first audio in <800ms p50
□ Interruption: user speech mid-AI-reply causes AI to stop within 200ms
□ Navigate-away cleanup: WS closes before next screen mounts

VERIFY
□ 10 consecutive sessions complete without leaked WS connections
□ Vapi dashboard shows session count matches start() invocations

**Extras:**
- Notes: [RESET 2026-05-05: was In Progress for Cartesia Line era. Reset to Not Started for Vapi pivot work.]

---

### P1-15 — Build useLLM hook for direct LLM calls (non-voice path)

**Status:** Not Started · **Priority:** High · Weight: 3 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm · Est: 2h · Criteria progress: 0/7

**Description:** React hook (useLLM) for Direct LLM (Path 3): non-voice text chat, free-form Cartesia voice, settings, insights, milestones.

**Detailed explanation:**

Path 3 is the simplest of the three: no Vapi, no async state machine, just POST to /api/llm and render the response. Used for text chat, settings UI, insights screens, etc.

SETUP
- Confirm /api/llm endpoint contract (P1-34 dep)

BUILD
- Implement useLLM(screenId, anonId) returning {sendMessage, response, isLoading, error}
- POST to /api/llm with {anon_id, screen_id, user_input}
- Stream response if backend supports SSE; else single response

VERIFY
- Text chat in HOME-FIRST works end-to-end
- No dependency on Vapi state (Path 3 must work even if Vapi is down)

**Acceptance criteria:**

SETUP
□ Hook signature documented in /docs/hooks.md
□ /api/llm contract pinned in /docs/api.md

BUILD
□ sendMessage() returns response within 1.5s p50
□ Loading state correctly toggles around the request
□ Hook works with Vapi entirely disabled (sanity for Path 3 isolation)

VERIFY
□ Text chat in a smoke screen renders 5 consecutive responses without error
□ No console references to Vapi or VoiceContext

---

### P1-16 — Frontend: useScreenContext + useLLM hooks

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm · Est: 2h · Criteria progress: 0/6

**Description:** Frontend hooks: useScreenContext(screen_id) fetches per-screen context; useLLM is the consumer for Direct LLM calls (P1-38 hook details).

**Detailed explanation:**

useScreenContext is the bridge between a screen and its AI context. It calls GET /api/context (P1-33) on mount, caches per-screen, and exposes the context block + state delta to the consumer.

SETUP
- Confirm GET /api/context endpoint live (P1-33)
- Confirm useLLM hook exists (P1-38)

BUILD
- Implement useScreenContext(screen_id) returning {contextBlock, stateDelta, refresh, isLoading}
- Cache context block locally per session (refreshes on screen mount)
- useLLM consumes useScreenContext to pass full context to /api/llm

VERIFY
- A screen mounts → useScreenContext fetches context → useLLM uses it

**Acceptance criteria:**

SETUP
□ Hook signatures pinned in /docs/hooks.md

BUILD
□ useScreenContext("WELCOME") returns the expected context block from a real fetch
□ Context refresh works (call refresh() → fresh data)
□ useLLM passes contextBlock + stateDelta in /api/llm POST body

VERIFY
□ Sample text chat in HOME-FIRST: response references the screen's context (proves wiring)
□ No duplicate /api/context fetches per screen mount

**Extras:**
- Notes: NEW core task in v6.0

---

### P1-17 — Frontend: Instrument session_log writes

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Frontend · Workstream: LLM · Assignee: mintesnotm · Est: 2h · Criteria progress: 0/7

**Description:** Wire frontend to write session_log events on every meaningful user action (taps, screen transitions, voice events).

**Detailed explanation:**

Path 2/3 LLM calls read session_log to catch up on what's happened since the last LLM turn. If frontend doesn't write events, the LLM is blind to user behavior between calls.

Event taxonomy (start small, add as needed):
- screen_enter, screen_exit
- voice_session_start, voice_session_end
- tool_call_invoked, tool_call_result
- user_input_text, user_input_voice
- profile_update

SETUP
- Confirm POST /api/session_log endpoint exists (P1-32)
- Decide on a thin client wrapper (e.g. logEvent(event_type, payload))

BUILD
- Add logEvent() helper in src/lib/sessionLog.ts
- Instrument: screen mount/unmount, navigate_next calls, every Vapi session boundary, every Direct LLM POST
- Buffer + batch writes if event volume is high (>10/sec)

VERIFY
- Walking through the onboarding flow generates a coherent event timeline
- callLLM (P1-34) reads from session_log and the LLM responds aware of recent events

**Acceptance criteria:**

SETUP
□ POST /api/session_log returns 200 for valid writes (P1-32 sanity)
□ logEvent() helper at src/lib/sessionLog.ts

BUILD
□ All 5 screen-mount events instrumented across onboarding screens
□ Vapi session start/end emit corresponding session_log events
□ Failed write retries 3x then drops (no infinite loop)

VERIFY
□ Walk through full onboarding → SELECT * FROM session_log shows expected sequence
□ LLM response references a recent event (proves the loop is closed)

**Extras:**
- Notes: NEW core task in v6.0

---

### P1-18 — Build onboarding screen shell

**Status:** Not Started · **Priority:** High · Weight: 2 · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1h · Criteria progress: 0/9

**Description:** Build the shared shell + components that all 9 onboarding screens (SPLASH through ONBOARD-BEGINNER-03) use, so each screen-wire task is just UI + a few lines of glue.

**Detailed explanation:**

The 9 onboarding screens repeat the same patterns: <VoiceProvider> wrapping, fetch screen context, open a Vapi session, render UI, handle text/tap fallback, listen for navigate_next, write session_log events. Build that pattern once as a shell, then each screen consumes it.

SETUP
- Confirm dependencies in place: P1-11 (VoiceContext), P1-16 (useRealtimeVoice), P1-41 (useScreenContext + useLLM)
- Pull canonical onboarding screen layout from Figma to identify shared chrome (header / banner / footer)

BUILD
- Component: <OnboardingScreenShell screen_id={...}> wraps children, hosts shared chrome
- Hook: useOnboardingScreen(screen_id) bundles useVoiceContext + useScreenContext + Vapi session lifecycle
- Component: <TextInputFallback> for users who declined mic — same submit interface as voice
- Component: <NextScreenHandler> listens for navigate_next tool call and routes
- Telemetry: shell auto-logs screen_enter/screen_exit to session_log

VERIFY
- Build a stub test screen using the shell — should reach 'Hello world via voice + via text' end-to-end
- All consumers of the shell get the same retry + error UX without writing it themselves

**Acceptance criteria:**

SETUP
□ Dependencies confirmed (P1-11 + P1-16 + P1-41 all merged)
□ Shared layout extracted from Figma into a single source of truth

BUILD
□ <OnboardingScreenShell> exists and wraps a stub child correctly
□ useOnboardingScreen() hook returns {voice, context, navigate, isLoading, error}
□ <TextInputFallback> appears + works when mic_permission='denied'
□ Shell auto-emits screen_enter/screen_exit session_log events on mount/unmount

VERIFY
□ Stub screen using the shell completes 'hello world' via voice path
□ Stub screen completes 'hello world' via text path (mic denied)
□ Removing the shell from the stub breaks both paths (sanity)

**Extras:**
- Notes: [RESET 2026-05-05: was In Progress for Cartesia Line era. Reset to Not Started for Vapi pivot work.]

---

### P1-19 — Wire all 9 onboarding screens to the shell

**Status:** In Progress · **Priority:** Critical · Weight: 5 · Tier: Frontend · Workstream: Wiring · Assignee: mintesnotm · Est: 1h · Criteria progress: 0/8

**Description:** Implement each onboarding screen (SPLASH, VOICE-PREFERENCE, MIC-PERMISSION, POST-AUTH-SIGNUP [DEPRECATED], ONBOARD-01..05) using the shell from P1-17. Each screen ships UI + screen-specific behavior, no shared boilerplate.

**Detailed explanation:**

Per-screen execution layer. Each screen is now ~50 lines: render its specific UI, declare its AI context lookup, handle its specific tool calls. Everything else (Vapi, fallback, navigation, telemetry) comes from the shell.

PER-SCREEN CHECKLIST (apply to each of 9 screens)
- Create src/screens/{SCREEN_ID}.tsx using <OnboardingScreenShell screen_id="{SCREEN_ID}">
- Render UI per Figma frame
- Confirm screen's AI context block exists in screen_contexts table (P1-31 dep)
- Wire any screen-specific tool calls (e.g. update_profile on ONBOARD-01)
- Tap/text fallback at parity with voice

SCREENS (in flow order)
- SPLASH: silent loading, auto-navigate when init complete (no LLM)
- VOICE-PREFERENCE: voice vs screen output choice (Vapi 'Can I talk?' broadcast, ~6s)
- MIC-PERMISSION: mic permission ask (Vapi pre-prompt + browser getUserMedia)
- POST-AUTH-SIGNUP [DEPRECATED]: welcome + trust-building (~85s, two Vapi sessions)
- ONBOARD-01: profile setup (name, age, focus) — assistant calls update_profile per field
- ONBOARD-FORK: habit selection from suggested list
- ONBOARD-BEGINNER-01: habit difficulty calibration
- ONBOARD-BEGINNER-02: first commitment + accountability framing
- ONBOARD-BEGINNER-03: wrap + first check-in scheduling

VERIFY
- End-to-end voice happy path covered by P1-26
- End-to-end manual happy path covered by P1-27

**Acceptance criteria:**

PER-SCREEN (apply to each of the 9)
□ Component file at src/screens/{SCREEN_ID}.tsx exists and uses the shell
□ UI matches Figma frame
□ AI context block for the screen present in screen_contexts table
□ Voice path: speak the trigger → AI responds → screen advances
□ Text/tap path: works at parity with voice

OVERALL
□ All 9 screens listed above are implemented and reachable in flow order
□ Removing the shell breaks all 9 (sanity: confirms shared infrastructure)
□ Total lines per screen <100 (each screen is a thin shell consumer)

---

### P1-20 — Bundle anon_id generation into the auth fix

**Status:** Not Started · **Priority:** High · Weight: 3 · Tier: Backend · Workstream: Infrastructure · Assignee: yonas · Criteria progress: 0/6

**Description:** Bundle anon_id generation INTO the in-progress TestFlight auth fix so we don't need a separate retrofit pass later.

**Detailed explanation:**

Yonas is mid-fix on TestFlight auth. While he's in there, he generates the anon_id at signup time. This avoids a separate sweep where session_log + posthog + callLLM would need anon_id retrofitted later.

Two tables result:
- identity_table: username, password, email, auth_user_id (the connector)
- user_profiles + behavioral tables: keyed on anon_id ONLY

Depends on the existing TestFlight auth bug fix (in flight as of 2026-05-04).

SETUP
- Coordinate with Yonas on the auth fix branch
- Confirm where in the signup flow anon_id should be generated

BUILD
- Add anon_id generation to signup handler (UUID v7 for time-ordering)
- Insert into user_profiles immediately on signup
- Auth code never touches anon_id post-signup

VERIFY
- New signups have anon_id row immediately after auth completes
- All existing P1-46 downstream wiring works without retrofit

**Acceptance criteria:**

SETUP
□ Branch off Yonas's auth fix; do not block its merge

BUILD
□ Signup flow generates anon_id and inserts user_profiles row in same transaction as auth
□ anon_id format = UUIDv7 (time-ordered)

VERIFY
□ End-to-end test: new TestFlight signup → user_profiles row exists with anon_id
□ Subsequent session_log writes succeed without retrofit
□ No code path generates anon_id outside the signup handler

**Extras:**
- Notes: Refinement of P1-46. Both should ship together.

---

### P1-21 — Anonymization MVP - anon_id everywhere downstream

**Status:** Not Started · **Priority:** High · Weight: 5 · Tier: Backend · Workstream: Infrastructure · Assignee: yonas · Est: 3h · Criteria progress: 0/6

**Description:** Anonymization MVP: add anon_id (UUID) column to user_profiles + downstream tables; RLS restricts user_id ↔ anon_id join to service_role only.

**Detailed explanation:**

Privacy promise from day 1. All behavioral data (session_log, habits, checkins, journal_entries, daily_goals) keys on anon_id, NOT auth user_id. Only service_role can join the two — even compromised user credentials can't expose behavior across users.

SETUP
- Migration adds anon_id UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE to user_profiles
- Update FK in: session_log, habits, habit_completions, checkins, journal_entries, daily_goals

BUILD
- Apply migration in dev → staging → prod
- Update API endpoints to read/write anon_id (not user_id) for behavioral data
- RLS policy on user_profiles: user_id ↔ anon_id join is service_role only

VERIFY
- Compromised auth.uid() cannot read another user's behavioral data via the join
- All existing behavioral writes still work after switch

**Acceptance criteria:**

SETUP
□ Migration file checked in and applied to all environments

BUILD
□ All 6 downstream tables FK on anon_id, not user_id
□ RLS policy denies non-service_role joins between user_profiles and any behavioral table

VERIFY
□ Penetration test: forge auth.uid(), attempt to read another user's session_log → denied
□ Existing behavioral writes (insert_checkin, log_event) succeed under new schema
□ ~3 hours total spend (per original estimate)

**Extras:**
- Notes: Stage 1. Privacy-first foundation. See Architecture tab.

---

### P1-22 — RLS policy audit (HARD GATE for direct-Supabase access)

**Status:** Not Started · **Priority:** Critical · Weight: 8 · Tier: Both · Workstream: QA · Assignee: mintesnotm + yonas · Criteria progress: 0/7

**Description:** HARD GATE: RLS policy audit for direct-Supabase architecture. Frontend talks straight to Supabase — RLS is the only thing standing between users and each other's data.

**Detailed explanation:**

Settled May 1: frontend talks directly to Supabase by design. This only works if RLS policies are bulletproof. This task is a formal audit + try-to-break test.

AUDIT CHECKLIST
- user_profiles: user can read/update own row only (auth.uid() = id)
- anon_id ↔ user_id join: service_role ONLY
- habits, habit_completions, checkins, journal_entries, daily_goals: user can read/write rows where anon_id matches their own
- session_log: append-only for the user's own anon_id; no cross-user reads
- MP3 storage bucket: read-only for authenticated users, write blocked

TRY-TO-BREAK
- Log in as user A, attempt to read user B's data via crafted queries
- Confirm denial at every table

VERIFY
- Every table passes its RLS test
- Audit report committed to /docs/rls-audit-{date}.md

**Acceptance criteria:**

AUDIT CHECKLIST
□ All 6 behavioral tables + user_profiles + storage bucket explicitly reviewed
□ Each policy documented with rationale

TRY-TO-BREAK
□ Cross-user read attempt on each table: explicitly denied
□ anon_id ↔ user_id join attempt as auth user: denied
□ MP3 bucket write attempt: denied

VERIFY
□ Audit report at /docs/rls-audit-2026-MM-DD.md
□ HARD GATE: no merge to main until all checks pass

**Extras:**
- Notes: HARD GATE - blocks launch. Cannot ship without sign-off.

---

### P1-23 — Vapi tuning + latency optimization pass

**Status:** Not Started · **Priority:** Medium · Weight: 5 · Tier: Backend · Workstream: Voice · Assignee: yonas · Criteria progress: 0/12

**Description:** Tune Vapi assistant config (endpointing, confidence, fallback voice) + STT vendor test (Cartesia Ink vs Deepgram) to reduce p50 turn latency under 600ms.

**Detailed explanation:**

Yair flagged this during a Vapi dashboard walkthrough: total latency ~840ms, with most of it accounted for by sequential STT (100ms) → LLM (390ms) → TTS (250ms). Goal: shave 200-300ms with no quality regression.

ENDPOINTING (biggest immediate win)
- Lower End of Turn Timeout from 5000ms to 2000-2500ms (5s feels dead; 2-2.5s feels conversational)
- Lower End of Turn Confidence from 0.7 to 0.55-0.60 (less waiting to confirm user is done)
- Keep Smart Endpointing Plan disabled (Vapi warning says this is required to leverage Flux end-of-turn detection)

FALLBACK VOICE
- Add a fallback Cartesia voice (generic, not cloned) so calls dont drop on Cartesia outages or voice_id issues
- ~5% of calls hit fallback; saves a session each time

STT VENDOR EVAL: Cartesia Ink vs current Deepgram Flux
- Run parallel sessions for one day on real coaching speech samples
- Compare WER (word error rate) and latency
- If Cartesia Ink within 1-2% WER of Deepgram: switch (vendor consolidation with our existing Sonic-3 TTS = single billing + SDK)
- If WER worse: stay on Deepgram
- RESOLVED (May 2026): neither — Soniox chosen as sole STT (multilingual, sub-200ms). Ink and Deepgram both dropped.

VOICE MODEL EVAL
- Test Cartesia Sonic 2 vs current Sonic 3 — Sonic 2 may be ~50ms faster, see if quality acceptable for the cloned voice
- Stay on Sonic 3 unless Sonic 2 is clearly close enough

LLM CHOICE
- GPT-4o Mini Cluster (current, 390ms) is the fastest in Vapis OpenAI dropdown despite GPT 4.1 Nano sounding faster (510ms actual). Confirmed; no change.
- If Vapi adds a new model with sub-300ms TTFT, re-evaluate.

**Acceptance criteria:**

ENDPOINTING
□ End of Turn Timeout set to 2000-2500ms in Vapi dashboard
□ End of Turn Confidence set to 0.55-0.60
□ Test conversation: AI responds within 1.5s of user finishing speech (down from current 3-4s)

FALLBACK VOICE
□ Fallback voice configured (Cartesia generic voice)
□ Verified by temporarily breaking primary voice_id; call uses fallback without dropping

STT VENDOR EVAL
□ One days worth of real Yair coaching speech tested on both Deepgram (current) and Cartesia Ink
□ WER + latency comparison documented in /docs/stt-eval.md
□ Decision (switch or stay) with rationale

VOICE MODEL EVAL
□ Side-by-side audio sample: Yairs cloned voice on Sonic 2 vs Sonic 3
□ Yair-reviewed by ear; decision documented

LATENCY TARGET
□ p50 user-perceived turn latency under 600ms (measured over 20 turns)
□ p95 under 900ms

---

### P1-24 — Test session_log integrity

**Status:** Not Started · **Priority:** Medium · Weight: 1 · Tier: Backend · Workstream: QA · Assignee: mintesnotm + yonas · Est: 1h · Criteria progress: 0/5

**Description:** Verify session_log integrity under load: high-volume writes, ordered reads, RLS enforcement, no duplicate events.

**Detailed explanation:**

session_log is append-only, but bugs could cause duplicates, out-of-order reads, or cross-user data leakage via RLS holes. This test stress-tests it.

PLAN
- Insert 10k events for one anon_id over 60s
- Read back with ORDER BY timestamp ASC
- Forge anon_id from another user, attempt read

VERIFY
- All 10k rows present, no duplicates
- Read order is strictly chronological
- RLS denies cross-user reads (forged anon_id returns 0 rows)

**Acceptance criteria:**

PLAN
□ Load test script in /scripts/test-session-log.py

VERIFY
□ 10k inserts over 60s complete without errors (sustained 167 writes/sec)
□ Read returns exactly 10k rows in chronological order
□ Forged anon_id read returns 0 rows + log entry for the denied attempt
□ No duplicate event_id observed

**Extras:**
- Notes: NEW QA task in v6.0

---

### P1-25 — Test AI Context across all channels (HARD GATE)

**Status:** Not Started · **Priority:** Critical · Weight: 5 · Tier: Backend · Workstream: QA · Assignee: mintesnotm + yonas · Est: 2.5h · Criteria progress: 0/5

**Description:** HARD GATE: verify AI Context (per-screen + global + state delta) is correctly assembled and consumed across all 3 paths.

**Detailed explanation:**

The 3-context model (per-screen / global / state delta) is the heart of consistent coaching. This test proves all 3 paths see the same context for the same situation, and the LLM responds aware of all 3 layers.

PLAN
- Set up a controlled user state (specific habits, recent session_log events, on a specific screen)
- Hit Path 1 (Vapi), Path 2 (Async Reflection), Path 3 (Direct LLM) with same user input
- Diff the context payload each path sends to the LLM

VERIFY
- All 3 paths see byte-identical context (proves shared context builder works)
- Each LLM response references the per-screen context AND the recent session_log event

**Acceptance criteria:**

PLAN
□ Controlled test fixture set up (test anon_id with seeded session_log + profile)

VERIFY
□ Diff Path 1 vs Path 3 context payload: empty
□ Diff Path 2 vs Path 3 context payload: empty
□ LLM response on each path references the per-screen rule + the recent state delta
□ HARD GATE: any drift between paths blocks merge

**Extras:**
- Notes: NEW HARD GATE in v6.0. Critical for launch.

---

### P1-26 — Test cost and latency budget

**Status:** Not Started · **Priority:** Medium · Weight: 2 · Tier: Both · Workstream: QA · Assignee: mintesnotm + yonas · Est: 1h · Criteria progress: 0/6

**Description:** Verify cost + latency budget: Vapi onboarding session <$0.10/user, p95 voice turn <2s, per-screen LLM call <500ms.

**Detailed explanation:**

Set cost + latency targets so we know when the architecture is too slow or expensive. Numbers come from current pricing for Vapi, Cartesia (Sonic API for check-ins), GPT-4o mini, and Cartesia STT/TTS.

PLAN
- Run 10 full onboarding flows (P1-26 happy path)
- Measure: per-call latency, total Vapi minutes, OpenAI tokens, Cartesia API usage
- Compute cost per user from real billing data

VERIFY
- p95 voice turn <2s
- p95 Direct LLM call <500ms
- Total cost per onboarding <$0.10

**Acceptance criteria:**

PLAN
□ 10 controlled runs completed and instrumented

VERIFY
□ p95 Vapi turn time across runs <2s
□ p95 Direct LLM call <500ms
□ Per-onboarding cost (Vapi + OpenAI + Cartesia) <$0.10 average
□ Outlier runs (slow + expensive) investigated and root-caused
□ Numbers documented in /docs/cost-latency-budget.md

**Extras:**
- Notes: NEW QA task in v6.0

---

### P1-27 — Test Full Happy Path (Voice)

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Backend · Workstream: Voice · Assignee: mintesnotm + yonas · Est: 2h · Criteria progress: 0/6

**Description:** End-to-end voice happy-path test of full onboarding flow (SPLASH → ONBOARD-BEGINNER-03) using mic only.

**Detailed explanation:**

Validates Path 1 (Vapi) end-to-end with no manual intervention. Confirms latency budget, navigation, session_log integrity, and user_profile correctness for the voice-driven path.

PLAN
- Run flow on dev environment with a clean test anon_id
- Use real mic; no automation that bypasses STT
- Capture timing for each Vapi turn

VERIFY
- Each screen advances within 2s of user finishing speech
- session_log has expected events in order
- user_profile populated with all collected fields
- No Vapi session leaked (count of session_start = count of session_end)

**Acceptance criteria:**

PLAN
□ Test plan documented in /docs/test-plans/P1-26.md
□ Test anon_id reserved for this run

VERIFY
□ Full flow SPLASH → ONBOARD-BEGINNER-03 completes via voice with zero manual input
□ Each Vapi turn p95 latency <2s
□ Final user_profile has name + age + focus + habits + first_checkin_at
□ session_log shows screen_enter for every screen, voice_session boundaries match

---

### P1-28 — Test Full Happy Path (Manual)

**Status:** Not Started · **Priority:** Medium · Weight: 2 · Tier: Backend · Workstream: QA · Assignee: mintesnotm + yonas · Est: 1.5h · Criteria progress: 0/6

**Description:** End-to-end MANUAL (text/tap-only) happy-path test — proves the app works without voice for users who decline mic.

**Detailed explanation:**

Mirror of P1-26 but exclusively via tap + text input. VOICE-PREFERENCE must offer 'Screen is fine' that disables voice for the rest of the flow. Confirms Path 3 (Direct LLM) handles onboarding.

PLAN
- Test anon_id, decline mic at MIC-PERMISSION
- Complete entire flow via tap + text only

VERIFY
- ai_output_mode = 'screen' propagates correctly
- All screens present text alternatives at parity with voice
- user_profile populated identically to the voice run

**Acceptance criteria:**

PLAN
□ Test plan in /docs/test-plans/P1-27.md
□ Mic permission denied at MIC-PERMISSION

VERIFY
□ Full flow completes via tap+text only
□ ai_output_mode='screen' set after VOICE-PREFERENCE and respected through ONBOARD-BEGINNER-03
□ user_profile fields match the voice-path run (P1-26)
□ No Vapi sessions appear in dashboard during this run

---

### P1-29 — Test Voice-Driven Navigation Edge Cases

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Both · Workstream: Voice · Assignee: mintesnotm + yonas · Est: 1.5h · Criteria progress: 0/5

**Description:** Test voice-driven navigation edge cases (interruption, repeat, back, ambiguous answers).

**Detailed explanation:**

The happy path (P1-26) covers cooperative users. Real users interrupt, ask to go back, give ambiguous answers. This task verifies the assistant + navigate_next handle the messy cases gracefully.

PLAN
- Edge: user says 'wait' mid-AI-reply → AI yields, listens
- Edge: user says 'go back' → assistant calls navigate_next(prev_screen)
- Edge: user gives ambiguous answer → assistant asks clarifying question
- Edge: user is silent for 10s → assistant prompts gently

VERIFY
- Each edge case resolves to a sensible state, no crashes, no duplicate navigation

**Acceptance criteria:**

PLAN
□ 4 edge scenarios documented + scripted in /docs/test-plans/P1-28.md

VERIFY
□ Interrupt: AI stops within 200ms of user speech start
□ 'Go back' from ONBOARD-FORK returns to ONBOARD-01 with state preserved
□ Ambiguous answer triggers a clarifying question (not a forced re-prompt)
□ 10s silence triggers a single gentle prompt, not a loop

---

### P1-30 — Test Partial/Edge Cases

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Both · Workstream: QA · Assignee: mintesnotm + yonas · Est: 2h · Criteria progress: 0/5

**Description:** Test partial-state edge cases: refresh mid-flow, browser back button, multi-tab, slow network.

**Detailed explanation:**

Users do unexpected things. Refresh in the middle of onboarding. Open the app in two tabs. Lose connection. This task verifies the app recovers cleanly without data corruption.

PLAN
- Edge: refresh mid-Vapi session → on reload, resume from last completed screen
- Edge: browser back button → either disabled or navigates intentionally
- Edge: open in 2 tabs → second tab shows current state (no divergent profiles)
- Edge: throttled network (3G in dev tools) → degraded experience but no corruption

VERIFY
- session_log + user_profile remain consistent across all edge cases

**Acceptance criteria:**

PLAN
□ 4 partial-state scenarios scripted in /docs/test-plans/P1-29a.md

VERIFY
□ Mid-flow refresh: app resumes at the last completed screen, no fields lost
□ Browser back: either disabled OR returns to previous screen with state intact
□ Multi-tab: both tabs reflect the same current state within 2s
□ Throttled (3G): no requests fail silently; user sees loading indicators

---

### P1-31 — Test crisis safety detection

**Status:** Not Started · **Priority:** High · Weight: 2 · Tier: Both · Workstream: QA · Assignee: mintesnotm + yonas · Est: 1h · Criteria progress: 0/7

**Description:** Test crisis / safety detection: AI must recognize self-harm signals and pivot per the safety rule, on both voice + text paths.

**Detailed explanation:**

Hard gate. The AI's tone is warm and conversational, but it MUST recognize crisis language (suicidal ideation, self-harm intent) and pivot to the safety response defined in Global Context. Tested on both Vapi (Path 1) and Direct LLM (Path 3) to prove the rule fires regardless of channel.

PLAN
- Use canonical crisis test phrases from /docs/safety-test-phrases.md (DO NOT commit phrases publicly)
- Test on both voice (mic) and text (chat) channels
- Verify response matches the documented safety script + provides crisis resources

VERIFY
- 100% of test phrases trigger safety pivot (zero false negatives)
- Pivot includes the crisis resource (hotline number / link) per Global Context
- Event logged to session_log with event_type='safety_trigger'

**Acceptance criteria:**

PLAN
□ Crisis test phrases set documented (private file, not public repo)
□ Both Vapi + Direct LLM channels included in test matrix

VERIFY
□ Voice path: every crisis phrase triggers safety response (5/5)
□ Text path: every crisis phrase triggers safety response (5/5)
□ Safety response includes resource link/number per Global Context
□ session_log shows event_type='safety_trigger' for each
□ NO false positives on benign phrases ('I had a hard day' should NOT trigger)

**Extras:**
- Notes: HARD GATE - blocks launch. UX-06 enforcement.

---

### P1-32 — Test on Android APK + Web

**Status:** Not Started · **Priority:** Medium · Weight: 3 · Tier: Both · Workstream: QA · Assignee: mintesnotm + yonas · Est: 2h · Criteria progress: 0/6

**Description:** Cross-platform smoke test: full onboarding on Android APK + Web (Chrome desktop + mobile Safari).

**Detailed explanation:**

Catches platform-specific issues — mic permissions UX differs by platform, WebSocket reliability varies, Safari often has audio playback quirks.

PLAN
- Android APK: install fresh build, run P1-26 happy path
- Chrome desktop: same flow on macOS or Linux
- Mobile Safari (iOS): same flow on a real iPhone

VERIFY
- All 3 platforms complete onboarding without platform-specific errors
- Cross-platform diff in user_profile shape: zero (same data, regardless of platform)

**Acceptance criteria:**

PLAN
□ APK build artifact pinned for this test run
□ Test devices listed (e.g. Pixel 7, MacBook+Chrome, iPhone 14+Safari)

VERIFY
□ Android APK: full onboarding completes; no permission UX bugs
□ Chrome desktop: full onboarding completes; no audio playback issues
□ Mobile Safari: full onboarding completes; no WS or audio issues
□ Resulting user_profile is byte-identical across all 3 platforms

---

### P1-33 — Document sync architecture decision in callLLM node

**Status:** Not Started · **Priority:** Low · Weight: 1 · Tier: Both · Workstream: LLM · Assignee: yonas · Criteria progress: 0/4

**Description:** Document the sync architecture decision in callLLM node prose so new contributors understand the 3-path model immediately.

**Detailed explanation:**

The 3-path model (Vapi for onboarding, Async Reflection for check-ins, Direct LLM for everything else) is non-obvious from code alone. New contributors need a 1-page explanation.

SETUP
- Confirm the model is stable (P1-34, P1-39, P1-42 in shape)

BUILD
- Write /docs/llm-paths.md: when each path is chosen, why, and how to add a new screen
- Add a comment block at the top of callLLM() pointing to the doc

VERIFY
- A new contributor reads the doc + comment and can explain the routing in 5 minutes

**Acceptance criteria:**

SETUP
□ Routing logic in callLLM() is stable (P1-34 done)

BUILD
□ /docs/llm-paths.md exists, ≤1 page, with a routing decision tree
□ callLLM() top comment links to the doc

VERIFY
□ New-contributor test: someone unfamiliar reads it and explains the 3 paths back correctly in 5 minutes

**Extras:**
- Notes: Quick win. Architectural reference.

---

### P1-34 — Team process improvements (Mattermost templates + acceptance criteria)

**Status:** Not Started · **Priority:** Low · Weight: 2 · Tier: Backend · Workstream: QA · Assignee: mintesnotm + alejandro · Criteria progress: 0/5

**Description:** Team process improvements: Mattermost task templates + acceptance-criteria gate before assigning.

**Detailed explanation:**

From the May 7 call: Yonas + Mint asked for more actionable task structure. This task captures the workflow improvements so the team uses them consistently.

SETUP
- Document the task template (already drafted at Claude Files/task-template-2026-05-07-1926.md)
- Define the gate: Yair sets Reviewed=☑ only after Description + Detailed Explanation + Acceptance Criteria are filled

BUILD
- Mattermost slash command (or pinned message) with the template
- Reviewer checklist for the supervisor: 'Are acceptance criteria testable?'
- Workflow doc: pickup → tested by owner → approved by supervisor → status=Done

VERIFY
- 1 week of new tasks all use the template
- All assigned tasks have non-empty Acceptance Criteria

**Acceptance criteria:**

SETUP
□ Template doc linked from team Mattermost channel topic

BUILD
□ Slash command or pinned template message in #guided-growth channel
□ Reviewer checklist documented in /docs/reviewer-checklist.md

VERIFY
□ Spot-check 10 tasks created in week following: 10/10 use the template
□ No task moves to In Progress without Acceptance Criteria filled

**Extras:**
- Notes: Process not engineering. Cross-cutting team improvement.

---

_Last refreshed: 2026-05-11_