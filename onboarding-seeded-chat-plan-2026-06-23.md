# Seeded chat experience — deep plan (2026-06-23)

Plan only. Scope: the **auth → profile setup** slice. Deliver the "bubble + card
per beat" chat feel with **seeded copy and no AI** (no LLM, no Cartesia, no
Soniox, no tool-gating). Minimize scope; everything past profile is untouched.

> Work in the LIVE repo `/Users/jonah/Documents/guided-growth-mvp`.

---

## 0. TL;DR

- Turn the current **cards-only** static feed into a **seeded conversation**: each
  beat renders a coach **chat bubble** (curated copy) with its **inline card**
  directly beneath, in one downward-scrolling thread; past beats freeze in
  scrollback. No AI — the bubble text comes from `getOnboardingOpener()`, the
  card is the user's answer surface.
- Implementation lands almost entirely in **`StaticFeed`** (inside
  `OnboardingChatPage.tsx`) + a small copy pass in **`onboardingOpeners.ts`**.
  The LLM/voice branch (`messages.map`) is left alone for the future.
- Scope ends at **profile setup**: beats 0 (auth) + 1 (profile). Beats 2+ keep
  rendering (same loop) but their copy/polish is out of scope.

---

## 1. Why this approach (vs the LLM feed)

The page already branches on `STATIC_FEED_MODE`:

- **Static branch** → `<StaticFeed>` — derives beats 0..current_step directly from
  `beatForStep`, renders each beat's **card** only. No session/LLM/voice.
- **Live branch** → `messages.map` — bubbles + inline cards driven by the voice
  session + `/api/llm` (currently silenced on the chat page).

Two ways to get seeded bubbles:

- **(A) Add bubbles to `StaticFeed`** — presentational, decoupled, no session
  plumbing. Static mode stays "seeded, no AI." When the LLM/voice loop lands
  later, the page flips to the live branch (already built). **Chosen** — lowest
  risk, matches the existing two-branch design, smallest surface.
- **(B) Un-silence opener _seeding_ in `useOnboardingChat`** (it already seeds
  `getOnboardingOpener` as a coach message + attaches the card) **but keep the
  LLM call off.** This reuses the live feed's rendering, but couples to the voice
  session and means splitting the silence flag (seed yes, call no) — more moving
  parts for the same visual result.

Decision: **(A)**. (B) becomes moot once the real LLM/voice loop is enabled,
because that IS the live branch.

---

## 2. Target experience (precise)

One vertical thread, built downward. For each beat `s` in `0..current_step`:

```
🟦 coach bubble  ← getOnboardingOpener(beat.screenId)   (seeded; omitted if none)
┌───────────────┐
│  inline card  │  ← buildActiveBeatCard(beat.cardType, state)
└───────────────┘     (the card IS the user's answer; stays frozen, pre-filled)
        … gap-12 …
🟦 next beat's bubble
┌ next card ┐
```

- **The frozen card is the "user answer."** Because input is taps, there's no
  separate user bubble — the filled, frozen card in scrollback is the record of
  what they entered. Thread reads: coach asks (bubble) → user fills (card) → next
  beat. (Optional acknowledgment bubble — §4, decision.)
- Active beat scrolls to viewport center on `current_step` change (existing
  `activeBeatRef` + `scrollIntoView`).
- Bottom **orb** stays (idle; voice off). **No** text composer.
- **Auth beat (0):** once authenticated the auth beat is hidden (`StaticFeed`
  starts at `1` when authed), so its bubble+card vanish on login and the profile
  beat becomes the top of the visible thread.

---

## 3. Implementation — files & changes

### 3.1 `src/components/onboarding/onboardingOpeners.ts` (copy)

- **Add an `ONBOARD-AUTH--FORM` opener** (the pre-auth welcome bubble) — see §4
  decision 1. e.g. `"Hey — I'm your coach. Let's get you set up. Create an account
to start, and I'll take it from there."`
- **Fix the `ONBOARD-01--FORM` / `ONBOARD-01` copy** — drop "type it here" (no
  composer now). e.g. `"OK, let me get to know you a little. First — what should I
call you? You can fill it in below."` Keep it channel-neutral (works for tap
  now, voice later).
- No structural change — `getOnboardingOpener` already returns `string |
undefined`; `StaticFeed` renders a bubble only when defined.

### 3.2 `src/pages/onboarding/OnboardingChatPage.tsx` (StaticFeed)

- `StaticFeed` already maps `steps → beat → card`. Add, **above the card**, a
  `<ChatBubble role="ai" text={getOnboardingOpener(beat.screenId)} … />` when an
  opener exists. Reuse the exact props the live branch uses for visual parity:
  `eyebrowVariant="dark"`, `compact`, `animate={false}`, `markdown`,
  `userName={displayName}`.
- Per-beat wrapper becomes a small column: `flex flex-col gap-3` holding bubble +
  card. Keep `activeBeatRef` on the **active** beat's wrapper (unchanged) and the
  parent `gap-12 py-12` rhythm.
- `StaticFeed` needs `displayName` (already in the page via `useDisplayName`) —
  thread it in as a prop (cheap) or read it inside. Prop is cleaner.
- No change to `cardApi`, the submit handlers, the auth auto-advance, or the orb.

### 3.3 (Optional — §4 decision 2) acknowledgment bubble

- After a beat submits, render a **templated** ack bubble for the just-completed
  beat in scrollback (profile only for v1): e.g. `"Nice to meet you, {nickname}."`.
- Source: a tiny `getOnboardingAck(screenId, data)` helper, OR reuse
  `getOnboardingRevisitOpener` (it already recaps filled fields:
  "Last time you told me your name's X…"). For a _forward_ ack, a dedicated
  one-liner per beat reads better than the revisit recap.
- Render only for beats strictly below `current_step` (completed) that have a
  non-empty value. Keep it to the profile beat in this scope.

---

## 4. Decisions for you (before building)

1. **Auth beat bubble** — (a) **welcome bubble** above the auth card
   (recommended; sets the conversational frame from line 1), or (b) **silent**
   (auth card alone, no bubble). Note: the beat _context's_ "stay silent" rule is
   an instruction to the **LLM** (don't call tools / speak) — a static seeded
   **display** bubble is a different layer and doesn't violate it.
2. **Acknowledgment bubble after submit** — (a) include for the **profile** beat
   (recommended; small; makes the frozen scrollback feel like a real exchange),
   or (b) **defer** — question bubbles only for v1.
3. **Copy ownership** — OK for me to lightly edit the seeded opener copy now (add
   AUTH, drop "type it here"), or will **Yair** supply final bubble copy? (I can
   ship sensible placeholders and swap when his lands.)

---

## 5. Explicitly out of scope (this slice)

- LLM-generated bubbles, the `/api/llm` turn loop, tool-calling/`advance_step`
  via the model, per-beat tool gating (Stage 2 of the beat-context plan).
- Voice: Cartesia TTS, Soniox STT, the conversational turn loop (`useCoachChat`
  port / "Stage C"). `STATIC_FEED_MODE` stays **on**.
- Beats past profile (fork, category, …). They still render through the same
  `StaticFeed` loop, but their bubbles/cards/copy are not polished here.
- Any backend change. This slice is frontend-only (copy + render).

---

## 6. Edge cases & details

- **Reload / resume mid-onboarding:** `StaticFeed` re-derives from `current_step`;
  bubbles are stateless (seeded), cards re-hydrate from `onboarding_states.data`.
  No persistence needed for bubbles.
- **Authed start:** `StaticFeed` `start = authed ? 1 : 0`, so a returning authed
  user opens directly on the profile bubble+card (auth beat hidden) — already
  handled.
- **Opener missing for a beat:** render the card with no bubble (graceful;
  several beats already lack openers — fine for out-of-scope beats).
- **displayName empty:** `ChatBubble` handles an undefined `userName`; the coach
  bubble doesn't depend on it (it's the user-eyebrow). No issue.
- **Channel-neutral copy:** avoid "tap"/"say"/"type" specifics in seeded lines so
  the same copy survives when voice turns on (mirror the existing
  `TEXT_INPUT_RULE` philosophy).

---

## 7. Testing & verification

- **Unit (light, node):** assert `getOnboardingOpener` returns copy for
  `ONBOARD-AUTH--FORM` and `ONBOARD-01--FORM`, and that the profile copy no longer
  contains "type it here". (Component render needs jsdom — skip for this slice.)
- **Manual run (the real milestone):**
  1. Logged-out → `/onboarding` → **welcome bubble + auth card** centered.
  2. Google sign-up → returns authed → auth bubble+card vanish → \*\*profile bubble
     - ProfileCard\*\* animate into center.
  3. Fill name/age/gender (referral optional) → Continue → advances to fork
     (out of scope; just confirm it doesn't break).
  4. Email sign-up → verify link → `/auth/callback` → lands back on the **profile**
     beat authed.
  5. Reload mid-profile → profile bubble+card re-render, card pre-filled.
- `npx tsc --noEmit` clean; `npx vitest run` green except the 3 pre-existing
  `resolveCheckinWindow` failures.

---

## 8. Effort / sequencing

- **Step 1 (core):** §3.1 copy + §3.2 StaticFeed bubbles. ~the whole feature.
- **Step 2 (optional):** §3.3 profile acknowledgment bubble.
- **Step 3:** §7 manual verification of the auth→profile handoff (+ any redirect
  fix if email/OAuth return doesn't land on profile).

All reversible; Step 1 ships the experience, Step 2 is polish, Step 3 is the
acceptance gate for "until profile setup."

```

```
