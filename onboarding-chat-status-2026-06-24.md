# Onboarding (chat-native) — Status Report

**Date:** 2026-06-24
**Owner:** Yonas
**Scope of this report:** Onboarding flow from **auth (Beat 0)** through **profile setup (Beat 1), inclusive.** Beats past profile (path fork, plan-building, advanced paths) are out of scope for this milestone.

---

## 1. What we're building (one paragraph)

We're converting onboarding from a multi-screen wizard into a **single chat-native page** (`/onboarding`). The user experiences it as a conversation with the coach: each "beat" is one coach line plus one inline card (auth, profile, etc.). A user's progress (`current_step`) drives which card renders. The backend builds the coach's prompt per-beat from a single source of truth, and the coach speaks each opener line aloud.

---

## 2. Current status — what's working

| Area                                 | Status     | Notes                                                                                                                                                                                                                      |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In-chat auth (Beat 0)**            | ✅ Working | Real Google sign-in, email signup ("check your email"), and login, all inside the chat. Apple = "coming soon" stub. Routing correctly lets unauthed users reach **only** `/onboarding`; all app routes still require auth. |
| **Profile setup (Beat 1)**           | ✅ Working | Nickname, age, gender, referral captured via inline card; validates nickname against the server rules.                                                                                                                     |
| **Auto-advance auth → profile**      | ✅ Working | Once authed, the page moves itself from Beat 0 to Beat 1.                                                                                                                                                                  |
| **Backend per-beat prompt pipeline** | ✅ Working | New single source of truth (`beatContexts.ts`) drives the coach's context, allowed tools, and opener line per beat. Onboarding no longer reads the old Supabase context table.                                             |
| **Coach speaks the opener**          | ✅ Working | The coach says each beat's opener line word-for-word, with text-to-speech (Cartesia).                                                                                                                                      |
| **"Never blank" guarantee**          | ✅ Holds   | The page always renders something instantly (a synchronous baseline card), even before the network responds. Verified intact under failure conditions.                                                                     |
| **Security / routing**               | ✅ Clean   | No way for an unauthed user to reach app data; no redirect loops. Independently reviewed.                                                                                                                                  |

---

## 3. What's intentionally NOT built yet (dormant by design)

- **Voice-in (user talking back).** The coach speaks, but the user currently responds **only by tapping cards** — there is no text box and microphone input is gated off. So today it reads as a _card wizard with a spoken coach_, not a back-and-forth dialogue. The full conversational turn-loop is the next major phase ("Stage C").
- **Code-enforced tool limits.** The backend _tells_ the coach which tools it may use per beat, but doesn't yet _enforce_ it in code ("Stage 2").
- **Beats past profile setup** — not polished; out of scope for this milestone.

---

## 4. Blockers / must-fix before this can ship

We ran a 4-track independent code review of the in-scope flow. Two genuine blockers:

### 🔴 Blocker 1 — Coach tool actions aren't gated by the current step

The coach can trigger data-saving actions (e.g. "save profile") regardless of which beat the user is on. If the model fires the wrong action at the wrong time, it can overwrite the user's profile data and skip them forward incorrectly. **This is the same class of bug we already fixed for check-ins on 2026-06-07 — the fix simply was never ported to onboarding.** Low effort to fix (reuse the existing pattern).

### 🔴 Blocker 2 — Silent failure if the coach's opening line fails to load

If the coach's opener fails (network blip, interrupted response), the error is swallowed: no error is raised, the recovery fallback never fires, and the page silently sits on the static card with **no coach line and no retry**. The screen is never blank, but the "coach speaks" promise quietly breaks and the user can get stuck. Low effort to fix.

**Neither blocker is a security issue** — routing and data isolation reviewed clean. Both are reliability/correctness and are small, well-understood fixes.

---

## 5. Secondary issues (should fix, not blockers)

- **"Feels static."** The coach's opener appears as a sudden pop-in instead of visible streaming/typing — there's no typing indicator while it loads. Cosmetic but affects the "is this alive?" feel.
- **Invalid navigation silently advances** the user by one step instead of refusing.
- **Email-verification link** returns the user to a standalone login screen rather than back into the chat — they recover, but the handoff is confusing.
- **Accessibility:** the text inputs (nickname/email/password) have no screen-reader labels.
- **Test coverage gap:** the new chat-native flow (cards + the coach's action dispatch + the auth→profile advance) has effectively **no automated tests** yet. The existing tests only cover the older code path.

## 6. Minor cleanup (low priority)

- A leftover "preferences" beat is dead code and should be removed or wired in.
- Path-choice card lacks proper accessibility roles; age silently defaults to 13 if untouched.

---

## 7. Recommended next steps (in order)

1. **Fix the two blockers** (tool gating + silent opener failure) + add tests around them. _Small, ready to start now._
2. **Polish the "feels static" experience** — typing indicator / visible streaming.
3. **Stage C — voice-in:** bring the user's spoken responses online so onboarding becomes a real two-way conversation (the largest remaining piece).
4. **Stage 2 — code-enforce tool limits** per beat.
5. Build/polish the beats after profile setup (separate milestone).

---

## 8. One-line summary for leadership

> Chat-native onboarding through profile setup is **functionally complete and reviewed** — auth, profile capture, the per-beat coach pipeline, and spoken openers all work. **Two small, well-understood reliability bugs** must be fixed before ship (one is a known pattern we've fixed elsewhere). The bigger remaining effort is making onboarding a true two-way _voice_ conversation rather than a spoken card wizard.
