# Standup 9 Jun 2026 — Task List

Derived from the 9 Jun standup. Grouped A–E; we'll work through them in order.

---

## A. Prompting & coach voice (system-prompt level)

- [~] **A1. Kill internal-narration phrases** ("I'm saving that", "Heading there now", "Let me add that", "One moment")
  - [x] Add `NO_INTERNAL_NARRATION_RULE` block in `api/_lib/llm/buildSystemPrompt.ts` (alongside existing `NO_PRENARRATION_RULE`) — `api/_lib/llm/noInternalNarrationRule.ts` + buildSystemPrompt.ts:119 composition
  - [x] Drop all 12 hardcoded `requestStart` narration strings in `api/_lib/llm/tools.onboarding.ts` — smoke-test silent mode (Option A). Initially shipped with `NEUTRAL_ACK = "Okay."` but pivoted to fully silent before commit so the LLM's natural next utterance fills the beat (matches the design comment on `ToolLifecycleMessages`). Revisit if dead air feels too long on slower tools — fall back to `NEUTRAL_ACK`.
  - [x] Drop priming parenthetical example in `api/_lib/llm/onboarding/systemPromptAddendum.ts:9`
  - [x] Add ai-qa catalog entry `ai-qa/rules/07-no-internal-narration.md` so `ai-qa-verify` covers the new rule
  - [ ] Mirror the rule into the Vapi assistant config (Path 1 lives in the Vapi dashboard / `gcartesia-agents/`, not `buildSystemPrompt.ts`) — **send rule text to Yair**
  - [ ] Master Sheet audit for narration leaks in "AI RESPONSE PATTERN" screen-context examples (VOICE-PREFERENCE, MCHECK-01, MCHECK-02) — needs Sheet edit + re-sync via `scripts/voice-sync/seed_contexts.py`
  - [ ] Acceptance: 10 onboarding sessions, zero "I'm saving" / "heading there" / "got it, moving on" instances
  - [ ] Follow-up: clean the narrating example on `systemPromptAddendum.ts:16` ("switched you to the advanced path") in next pass

- [ ] **A2. One acknowledgement per section, not per field**
  - [ ] Add prompt rule: "Acknowledge naturally at most once per screen group. Between fields, just ask the next question."
  - [ ] Decide whether ack policy is global or per-screen (`screen_contexts.acknowledgement_policy` lane if per-screen)

- [ ] **A3. Tool-failure recovery — retry silently, don't re-ask**
  - [ ] Backend: in `/api/llm` tool dispatcher, return `{ok:false, retryable:true, captured_args:{...}}` on tool error
  - [ ] Prompt rule: "If a tool call fails but the user already gave the answer, retry with captured arguments. Do not re-ask unless the field is genuinely missing."
  - [ ] Add test: simulated tool failure → model retries with same args, does not re-prompt user

- [ ] **A4. Habit ≠ goal in onboarding copy**
  - [ ] Audit `screen_contexts` rows for `ONBOARD-*HABIT*` and `ONBOARD-*GOAL*` — remove/rephrase "goal" wording
  - [ ] Fix in Master Sheet first (source of truth)
  - [ ] Re-sync via `scripts/voice-sync/seed_contexts.py`
  - [ ] Regenerate bundle `src/generated/screen_contexts.json`

- [ ] **A5. List-style output for categories / subcategories / habits**
  - [ ] Prompt rule for relevant onboarding screens: "Short intro line + bullet list, each bullet ≤ 8 words"
  - [ ] Decide: markdown bullets OR structured `options[]` schema returned from the model
  - [ ] If structured: define schema, update renderer

---

## B. Tool definitions & tool selection

- [ ] **B1. Per-screen tool scoping** (Yair's ask)
  - [ ] Find where the tool catalog is exposed to the model (likely `api/_lib/llm/tools/` or a `chooseToolsForScreen()`-equivalent)
  - [ ] Add `tool_scope` allowlist per screen (in `screen_contexts` or sibling sheet)
  - [ ] Pass only allowlisted tools to the model per screen
  - [ ] Document the tradeoff (deterministic per-screen vs dynamic full-catalog) in `.claude/skills/path-3-direct-llm/`
  - [ ] Decision rule: scope for onboarding + check-ins, keep dynamic for free chat

- [ ] **B2. Tool-call observability** (do this first — unblocks everyone's debugging)
  - [ ] Add structured log on every tool call in `/api/llm`:
    - `anon_id`, `screen_id`, `turn_id`, `tool_name`, `tool_args`, `tool_result_status`, `latency_ms`, `model_chose_from: [...]`
  - [ ] Surface in Vercel logs (server-side)
  - [ ] Add `?debug=1` dev-only overlay panel that streams the tool-call trace live during QA

- [ ] **B3. Tool catalog inventory** (foundation for B1)
  - [ ] Write a single MD doc listing all ~12 tools
  - [ ] Columns: tool name, owner, screens used on, args, side effects (table writes), known failure modes
  - [ ] Land in `.claude/skills/app-tasks/` or new `app-ai-tools` skill

---

## C. State / persistence bugs

- [ ] **C1. Closing chat returns user to fork, answers not persisted** (Timothy's bug)
  - [ ] Repro: onboarding chat → answer 2 fields → close overlay → re-open app
  - [ ] Check `OnboardingChatOverlay` close handler
  - [ ] Check `useOnboardingAgent` cleanup path
  - [ ] Check `onboarding_states.current_step` advancement on tool success
  - [ ] Check realtime subscription on `onboarding_states`
  - [ ] Likely Jamy's lane — coordinate before touching

- [ ] **C2. Advanced flow capped at 2 habits** (Yair's bug)
  - [ ] Open `useAdvancedPath` / advanced-flow voice-input branch
  - [ ] Grep `MAX_HABITS`, `habitCap`, hardcoded `2` in advanced path
  - [ ] Fix: advanced unlimited, beginner stays capped

- [ ] **C3. Chat-message save on overlay dismiss** (sister bug to C1)
  - [ ] Verify `chat_messages.content` flushes for in-flight messages when overlay closes
  - [ ] Test: send message + immediate close → message should still persist

---

## D. Logging / QA infrastructure

- [ ] **D1. Structured server-side tool-call log** — same as B2, do not duplicate

- [ ] **D2. Session replay export**
  - [ ] New admin endpoint inside `api/admin/[...path].ts` (stay under the 12-function cap)
  - [ ] Input: `anon_id` + time window
  - [ ] Output: JSON bundle of `session_log` + `chat_messages` + tool-call traces
  - [ ] Format must be Claude-readable for the "feed logs to Claude" workflow

- [ ] **D3. "Living bugs doc" workflow**
  - [ ] Write a one-page Claude prompt template: "identify tool failures, narration leaks, repeated questions, state drops"
  - [ ] Land in `.claude/skills/` so it's reusable per QA session
  - [ ] Define where the running bugs doc lives (this repo? `gg-spec/`?)

---

## E. Product-logic changes (not strictly AI, but blocking)

- [ ] **E1. Remove "goals" from MVP onboarding**
  - [ ] Spec change: Yair updates Master Sheet
  - [ ] Code follow-up after sync: screens, tool args, screen_contexts, system-prompt copy

- [ ] **E2. Habit flow = category → subcategory → recommended habits**
  - [ ] Confirm screens exist in current build
  - [ ] Confirm the prompt presents recommendations immediately after subcategory selection (ties into A5)

- [ ] **E3. Home screen outdated vs Figma**
  - [ ] Mint's frontend task — tracking only, not in Yonas's lane

---

## Suggested working order

1. **B2** (tool-call logging) — first; unblocks all debugging
2. **A3** (tool-failure retry) — pair with B2 (same dispatcher PR)
3. **B3 → B1** (catalog, then per-screen scoping)
4. **A1 / A2 / A4 / A5** (prompt rules — pair with Yair on copy)
5. **C1 / C3** (persistence) — coordinate with Jamy
6. **C2** (advanced-flow cap) — quick fix once located
7. **D2 / D3** (replay export + living bugs doc workflow)
8. **E1 / E2** — follow Master Sheet updates from Yair
