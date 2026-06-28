# Onboarding Conversation Persistence + Vapi Finalization Plan

The two asks: (A) **lifetime, server-side persistence** of the _whole_ conversation
— Direct-LLM, Soniox (your speech), Cartesia/Vapi (coach speech), the opener —
so nothing is ever lost across refresh, next-beat, tab close, or device; and
(B) **finalize the Vapi integration** — opener from the transcript, every beat
(beginner **and** advanced) integrated well.

---

## Where we are today

| Turn source                         | Saved to Supabase? | Where                                                                         |
| ----------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| Direct-LLM text turns               | **Yes**            | `chat_messages` via `persistChatTurn` (`api/llm/[...path].ts`)                |
| Vapi voice transcript (you + coach) | **No**             | nowhere server-side — only the structured answers land in `onboarding_states` |
| Cartesia opener                     | **No**             | rendered as authored karaoke text, never a transcript turn                    |
| Refresh survival (any path)         | local only         | `onboardingThreadStore` → localStorage, per-tab                               |

So the conversation lives in three disconnected places: `chat_messages` (text
only), the Vapi platform (their transcript, not mirrored), and localStorage
(this tab only). Nothing gives you the lifetime, cross-device thread you want.

The building blocks already exist:

- **`chat_messages`** (migration 035) — the "chart". Columns: `anon_id`,
  `chat_session_id`, `screen_id`, `turn_index`, `role` (`user`/`assistant`/`tool`),
  `content`, `mode` (`chat`/`opener`). UNIQUE `(chat_session_id, turn_index)`.
- **`getOrCreateOnboardingChatSessionId()`** — one session id for the whole
  onboarding journey (already used by the Direct-LLM path).
- **`api/chat/[...path].ts`** — already serves `history` / `linear` / `session`.
- **Provider `messages: VoiceMessage[]`** — the single chronological store every
  turn already flows through (`handleTranscript` appends Vapi user+coach finals,
  tagged by `screenId`).

The gap: the **Vapi provider never persists** and **never uses the shared session id**.

---

## Part A — Lifetime server-side persistence

Goal: every final turn from every path lands in `chat_messages` under **one
onboarding thread**, hydrated on load → survives refresh, next-beat, tab close,
new device. Direct-LLM and Vapi turns interleave into the same thread in order.

1. **One shared, durable session.** Point the Vapi provider at the _same_
   `getOrCreateOnboardingChatSessionId()` the Direct-LLM path uses, so both paths
   write one interleaved thread. Upgrade resolution from "sessionStorage only"
   to **resume-by-`anon_id`**: on load, ask the server for the latest onboarding
   session for this `anon_id` (reuse/extend `api/chat/session`) so a new tab or
   device continues the same lifetime thread. sessionStorage stays as the
   fast-path cache, not the boundary.

2. **New write endpoint — `POST /api/chat/append`** (a route in the existing
   `api/chat/[...path].ts`, no new function). Idempotent INSERT into
   `chat_messages`:
   - **`id` = a server-minted UUID.** The provider's `VoiceMessage.id` is
     `vapi-user-<ts>` / `voice-err-<ts>` — **not a UUID** — so it cannot be the PK
     (the column is `UUID`, `035:4`; inserting the string throws). Dedup instead on
     a new TEXT idempotency column `client_turn_key` (the `vapi-role-<firstFinalTs>`
     string) with a UNIQUE `(chat_session_id, client_turn_key)` — migration adds it.
   - **`turn_index` under the SAME advisory lock as the text path.** Open a
     dedicated client, `BEGIN`, `SELECT pg_advisory_xact_lock(hashtext($session))`,
     then `turn_index = COALESCE(MAX+1,0)` (byte-for-byte `persistChatTurn`,
     `api/llm:386-401`). Without this lock the new writer races the Direct-LLM
     writer and collides on UNIQUE `(chat_session_id, turn_index)` — `pg.Pool max:1`
     does NOT prevent this (separate functions/processes).
   - **`ON CONFLICT (chat_session_id, client_turn_key) DO UPDATE SET content =
EXCLUDED.content`** — UPDATE, not DO NOTHING, because a turn's text grows after
     the first write (see point 3). The id-on-conflict idea is the wrong constraint.
   - `role`: map provider `ai` → `assistant` (CHECK rejects `'ai'`, `035:9`).
   - `mode`: `opener` for the opener turn, else `chat`. `screen_id` from the turn.
   - **Truncate `content` to ≤ 8000 chars** (CHECK `035:6`) — a long coach monologue
     would otherwise throw.
   - `anon_id` from `requireUser()` (JWT) — never client-sent (memory: anon_id only).
   - Unscrubbed for `ONBOARD-*` (gotcha #8 — deliberate).

3. **Provider mirrors on TURN-CLOSE, not per-final**, fire-and-forget. Vapi emits
   one coach turn as several finals seconds apart; the merge logic grows the LAST
   bubble's text in place under a fixed id (`provider:807-818`). "Final" ≠ "turn
   complete." So the mirror fires when the turn actually closes (user-partial
   boundary `~747`, screen change `~1493`, call end/restart), POSTing the final
   merged text under that turn's stable `client_turn_key`. The UPDATE-on-conflict
   means a re-fire with grown text lands the complete utterance. **One turn = one
   row.**
   - **Mirror only `vapi` / `opener` turns.** Add a `source` discriminator to
     `VoiceMessage` (`'vapi' | 'direct_llm' | 'opener' | 'error'`). Direct-LLM turns
     are ALREADY persisted by `persistChatTurn` — re-POSTing them double-writes; error
     bubbles must never persist.

4. **Hydration on load = server first.** On `SIGNED_IN`/`INITIAL_SESSION`, fetch the
   onboarding thread and seed `provider.messages`. **Use the anon_id-scoped resolver
   (below), then `history?chat_session_id=…` (session-scoped, ordered by
   `turn_index`, `[...path].ts:133`).** Do NOT use `linear` for render order — it
   sorts `created_at DESC` and returns every screen the user ever touched.
   - **Dedup on seed.** `applyStartThread` has zero dedup (`applyStartThread.ts:8`):
     server seed + localStorage cache + live turns would triple. Add a
     dedup-by-`client_turn_key` merge; hydrated turns must carry the server identity
     forward, not mint fresh ids.

5. **Resume-by-anon_id is NET-NEW (not "reuse `api/chat/session`").** `handleSession`
   resolves by `(anon_id, screen_id)` in a 12h window (`SESSION_RECENCY_MINUTES=720`,
   `[...path].ts:13,258`); onboarding spans many screen_ids and after 12h / a new
   device it mints a fresh id and orphans the thread. The onboarding session id is
   never written to `chat_sessions` either. So add an explicit onboarding-thread
   anchor: write the onboarding `chat_session_id` to `chat_sessions` under a sentinel
   `screen_id='ONBOARDING'` at first mint, and a `GET /api/chat/onboarding-thread`
   that resolves it by `anon_id` alone. THIS is what delivers cross-device + lifetime.

6. **Ordering authority = `turn_index`, single source.** Both writers take the
   advisory lock, so indices are monotonic at write. Accept that a late-arriving Vapi
   final is appended at the tail (persist-time, not spoken-time) — acceptable for
   onboarding's mostly-sequential flow; revisit with a spoken-time column only if it
   visibly misorders.

7. **Retention.** "Lifetime" = no auto-prune for onboarding; stored unscrubbed per
   gotcha #8. Matches the ask — flagging so it's a conscious choice.

8. **Lifecycle caveat.** `clearOnboardingChatSessionId()` runs on completion
   (`useOnboarding.ts:106`) and user-switch (`SessionLogProvider.tsx:92`); sessionStorage
   also dies on tab close. The session id is therefore NOT durable on its own — the
   anon_id resolver (point 5) is what makes the thread survive these. Multi-tab opens
   two session ids (per-tab sessionStorage); they only reunify through the anon_id
   resolver, ordered by their own `turn_index` per session.

Net: `chat_messages` becomes the one durable record of the entire onboarding
conversation, every path, forever — but only with the advisory lock, the
`client_turn_key` dedup, the turn-close trigger, and the anon_id resolver. Drop any
one and it silently loses or duplicates turns.

---

## Part B — Opener from the transcript (finish the staged rework)

Today the opener is authored karaoke text pushed as a `coach` step in `BeatView`.
Per the bug report it must render from the **spoken transcript**, like every other
line, and be persisted (Part A).

**Blocker the review surfaced:** `LiveBeatConversation` deliberately slices the feed
from the **first user turn** and skips every pre-user coach turn
(`BeatPlayer:90-93,103-105`). So simply appending the opener to `messages` renders
NOTHING, and removing the authored `BeatView:51` step leaves the beat with **no
opener at all**. It also does NOT double today (authored step renders it; the
`messages` copy is skipped). So Part B is a real rework, not a deletion:

- **Rework `LiveBeatConversation` to render the leading opener.** Stop slicing from
  the first user turn — render the beat's coach opener turn first (from `messages`),
  then the rest of the feed. This is the prerequisite for every bullet below; do it
  first.
- **Cold-start beat** (Cartesia speaks the opener while Vapi connects): append the
  opener to `messages` (`source:'opener'`, `role 'ai'`, `screenId`, `mode 'opener'`)
  at the `speakOpener` call site (`provider:~907`) — there is no TTS speech-start
  callback (`speakOpener` only resolves on `done`), so it's a manual append. **Hoist
  `appendMessage` above `buildOverridesForCall`** (or use a ref) — it's currently
  defined later (`~1033`), a temporal-dead-zone hazard if referenced at `~838`.
  Reconcile the opener text source: cold-start speaks `getOnboardingOpenerForState`
  while the authored line is `node.voice.openerText` — pick one so the persisted and
  displayed text match.
- **Warm beat** (Vapi speaks the opener via the directive): already lands in
  `messages` via `handleTranscript` — once `LiveBeatConversation` renders the leading
  coach turn, drop the authored step so it's not shown twice.
- **Text-mode fallback** (no voice): keep the authored opener as the visible line and
  append it (`source:'opener'`) so it persists — but guard `hasExistingTurn(sid)`
  (`provider:1122`) so the opener append doesn't suppress the legitimate Direct-LLM
  opener stream.
- **Re-slot the card:** the card reveals **after** the opener message lands. Active
  branch becomes: `LiveBeatConversation` (leading opener + turns) → card revealed on
  opener-present.

---

## Part C — Every beat integrated (beginner + advanced)

- `CHAT_VAPI_BEAT_SCREENS` is already widened to all beats; **validate** each
  actually engages live, including `ONBOARD-ADVANCED` and any advanced sub-beats.
- Confirm advanced nodes exist in the flow builder + are emitted by
  `build-beat-bundle.ts` into `beat_contexts.json`, with synced copy in
  `beatContexts.ts`. Add any missing advanced beat to both.
- **Live mic-pass sweep per beat:** opener-from-transcript (no double), turn
  order, habit 03→04 stays live (no teardown), refresh + new-tab restore from
  server, idle teardown holds.

---

## Part D — Remaining coordination (from the handoff §7)

- Idle/cost teardown confirmed with all beats live (don't burn Vapi credits).
- `BEGINNER-06` order copy vs. machinery desync (nav correct; copy slightly ahead).
- **Vapi global unification** — fold the dashboard global into the synced
  `onboarding_globals`, dedupe the `{{initial_screen_context}}` slot. Shared
  assistant config → Yair.
- OAuth redirect URLs per env + **deploy** the beat-context sync.

---

## Sequencing (revised after review)

Part A is bigger than first scoped — it carries a migration and a new resolver,
not just one endpoint. Order:

1. **A0 — migration** (`053`): add `chat_messages.client_turn_key TEXT` + UNIQUE
   `(chat_session_id, client_turn_key)`; add the `chat_sessions` onboarding anchor
   (sentinel `screen_id='ONBOARDING'`). (`chat_sessions` is migration **047**, not
   044 — fix the stale `api/chat:293` log string too.)
2. **A1 — write path**: `POST /api/chat/append` with the advisory lock, UPDATE-on-
   conflict, content truncation, anon_id from JWT.
3. **A2 — provider wiring**: import the shared session id; add `VoiceMessage.source`;
   mirror on **turn-close** (only `vapi`/`opener`); fire-and-forget.
4. **A3 — resolver + hydration**: `GET /api/chat/onboarding-thread` (by anon_id) →
   `history` (session-scoped) → dedup-by-`client_turn_key` seed of `messages`.
5. **B — opener**: rework `LiveBeatConversation` to render the leading opener FIRST
   (prerequisite), then cold-start append + hoist + warm-beat de-dup + text guard +
   card re-slot.
6. **C — all-beats live validation** (beginner + advanced); needs a mic pass.
7. **D — coordination** (idle/cost, BEGINNER-06 copy, Vapi global, deploy; some Yair).

A0–A3 and B are type/test-checkable here. The advisory lock, the turn-close trigger,
the `client_turn_key` dedup, and the anon_id resolver are load-bearing — the review
showed dropping any one silently loses or duplicates turns. C needs live voice; D is
partly shared-config / deploy.
