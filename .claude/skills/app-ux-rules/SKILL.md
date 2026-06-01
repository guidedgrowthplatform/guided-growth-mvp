---
name: app-ux-rules
description: Use when working with UX rule IDs (UX-01 through UX-23), looking up rules for mic persistence, voice-driven navigation, MP3 broadcast behavior, crisis safety boundary, anonymization, voice cap, coaching brevity, tooltip tour, async reflection, or any screen referencing "UX Rules Ref"
user-invocable: false
---

# UX Rules

Source: Google Sheet **Guided Growth OS App Master** · tab `UX Rules` · gid `1169394369` · maintained by Yair + Timothy.

23 global UX rules referenced by the Screens tab. Authoritative behavior contract — when a Screen row lists `UX-XX` in the **UX Rules Ref** column, the rule applies in full.

## When to use
- A screen spec mentions `UX-01` … `UX-23` (or one of the well-known anchors below).
- Building a feature that touches voice, mic, navigation, coaching responses, anonymization, or tooltips — check whether a rule already constrains it.
- Reviewing whether a proposed copy / behavior violates a rule.
- Resolving "is this allowed?" questions about voice cap, info icons, brain-dump language, or crisis handling.

## Quick index

| ID | Anchor | One-line |
|---|---|---|
| UX-01 | MP3 one-way broadcast | Pre-recorded MP3 plays one-way; user responds by tap only. Check-in MP3s only (NOT onboarding — that's live Vapi). |
| UX-02 | Mic stays listening | Once granted + ON, mic never requires re-tapping during a session. |
| UX-03 | Voice-driven navigation | In voice mode, conversation IS the navigation. LLM calls `navigate_next`. |
| UX-04 | Stop audio on user action | MP3 must stop immediately when user taps / navigates. Check-in MP3 flow only. |
| UX-05 | Two independent voice settings | `ai_output_mode` (voice/screen) and `mic_permission` (on/off) are independent. |
| UX-06 | Crisis safety boundary | Self-harm / suicidal language → STOP coaching, respond once with 988, do not continue. Global system prompt rule. See `GC-15`. |
| UX-07 | No "brain dump" language | Never use "brain dump"; say "tell me what's going on" / "what's on your mind". |
| UX-08 | No info / (i) icons | No info icons in any screen. AI explains via voice or UI text is clear. |
| UX-09 | Both voice and text always work | Every action has voice OR text/tap path; voice is preferred, never the only way. |
| UX-10 | Friction removal not fragmentation | Position around removing friction from habit formation, NOT "replace 5-7 apps". |
| UX-11 | Insights only at 3+ data points | LLM does not generate patterns/correlations until ≥3 supporting data points. |
| UX-12 | Voice conversation cap (silent) | 5 free-form voice convos/day cap; check-ins don't count; cap is silent (no counter). |
| UX-13 | Coaching brevity | Morning: 1-2 sentences. Evening: 2-3. Voice convos: 4-5 max. No speeches. |
| UX-14 | Single coaching style for MVP | MVP = Warm & Thoughtful only. No style selector in MVP settings. |
| UX-15 | "Come back later" pause | User can pause onboarding; state saved in `onboarding_state`; AI does not nag. |
| UX-16 | Mic timeout — 8s gray, sticky user-off | 8s silence → gray (auto-reactivates on interaction). User-off is sticky. |
| UX-17 | AI button voice/text toggle | Voice → text flip cuts AI audio immediately. Text mode + chat closed → subtitles overlay. |
| UX-18 | Chat overlay is transcript-only | Chat open/close has zero effect on AI behavior (controlled by AI button). |
| UX-19 | Sequential spotlight tour on first home arrival | TT-01..TT-08 sequential after 5s pause. Other screens auto-dismiss tooltips. Show ONCE per account. |
| UX-20 | Anonymization — `anon_id` everywhere | All behavioral tables + PostHog keyed to `anon_id`, never `user_id` or email. See P1-46. |
| UX-21 | Async reflection check-in pattern (NOT Vapi) | Check-ins use MP3 + Soniox STT + Cartesia Sonic API. Vapi is reserved for onboarding + feedback sessions. |
| UX-22 | Voice + text sync (Option A) | When AI speaks, corresponding text appears alongside audio. Approximate timing, no karaoke for MVP. |
| UX-23 | Feedback sessions — scheduled Vapi triggers | 1 week + 1 month after signup + manual button. ~7 min open-ended via Vapi. See P2-31. |

## Full data

| ID | Rule Name | Description | Applies To | Examples | Source | Status |
|---|---|---|---|---|---|---|
| UX-01 | MP3 plays one-way (broadcast) — check-in MP3s only | Pre-recorded MP3 audio plays one-way like a broadcast. The user cannot interrupt or respond by voice. User responds by tap only. SCOPE: Phase E check-in MP3 prompts (morning prompt, evening prompt, thinking acks, closings). Does NOT apply to onboarding screens (SPLASH, PREF, MIC, POST-AUTH) — those are now LLM-active with live Cartesia agent (no MP3s) per the v2 MVP plan. | MCHECK-01, MCHECK-02, ECHECK-01..06, voice cap message | Splash hook plays ~8s; user taps any auth button to stop and proceed. Voice does NOT respond to user speech (mic not granted yet). | Voice Journey doc §2.1 | Active \| Updated v2 plan May 2026 |
| UX-02 | Mic stays listening once granted | Once mic permission is granted and the mic is ON, it stays listening throughout an active voice session. User NEVER has to tap the mic again to continue. Only time a user taps the mic is to turn it back ON after they (or the system) turned it OFF. | All LLM-active screens (ONBOARD-01+, all check-ins, voice convos) | Onboarding completes without re-tapping mic. Morning check-in: user speaks multiple times without re-tapping. Non-negotiable. | Voice Journey doc §2.4 | Active |
| UX-03 | Voice-driven navigation (no tap to advance) | In voice mode, user NEVER taps a button to advance. The conversation IS the navigation. When LLM detects step complete, it calls `navigate_next`; frontend transitions; new screen's context is fetched; conversation continues. Navigation logic in agent's system prompt, not hardcoded per screen. | All LLM-active screens in voice mode | ONBOARD-01: agent fills 4 fields → `navigate_next` → ONBOARD-FORK loads with new context. ONBOARD-BEGINNER-10: user says "let's go" → `complete_onboarding` → Home loads. | Voice Journey doc §2.5 | Active |
| UX-04 | Stop audio on user action | When pre-recorded MP3 is playing and the user takes any action (tap, navigate away), the audio MUST stop immediately before the action proceeds. No overlapping audio. No stuck audio. SCOPE: check-in MP3 flow only (onboarding now uses live Cartesia). | Phase E check-in screens | User taps "Sign up with email" during splash hook → audio stops, OAuth opens. User navigates back from POST-AUTH-SIGNUP [DEPRECATED] → welcome audio stops. | Voice Journey doc §2.1 | Active \| Updated v2 plan May 2026 |
| UX-05 | Two independent voice settings | `ai_output_mode` (set at VOICE-PREFERENCE: 'voice' or 'screen') and `mic_permission` (set at MIC-PERMISSION: granted or denied) are independent. User can have AI in screen mode but still use their mic. Both modes use the same `callLLM()` wrapper — just different paths. | All LLM-active screens, VOICE-PREFERENCE, MIC-PERMISSION, SETTINGS | Voice + mic on = full. Voice + mic off = AI speaks, user types. Screen + mic on = user speaks, AI writes. Screen + mic off = user types, AI writes. | Voice Journey §2.4 + VOICE-PREFERENCE spec | Active |
| UX-06 | Crisis safety boundary (one global system prompt rule) | If user expresses self-harm, suicidal thoughts, or wanting to die: AI must STOP coaching, respond ONCE with care + 988, and not continue normal conversation. IMPLEMENTATION: single rule in base coaching system prompt used by `callLLM()`. Same on all paths. See `P1-47` and `GC-15`. | All AI conversations — global via `callLLM()` system prompt | Voice convo: "I'm having thoughts of hurting myself." AI: "I hear you, and what you're feeling matters. Please reach out to 988 — call or text — for support right now. I'm an AI and not equipped to help with this the way you deserve." Then AI does NOT continue. | Voice Journey doc + Phase 1 task P1-29b (HARD GATE) | Active \| Updated v2 plan May 2026 |
| UX-07 | No "brain dump" language | Never use the phrase "brain dump" or imply the user is dumping thoughts. Use "tell me what's going on" or "what's on your mind". | All LLM-active screens, especially CHAT, ECHECK-05 | Bad: "Brain dump everything you're feeling." Good: "What's on your mind?" | Yair's product decisions | Active |
| UX-08 | No info / (i) icons in UI | Do not use info icons or (i) tooltips in any Guided Growth screen. If something needs explaining, AI explains via voice or UI text is clear. Info icons add visual clutter and wrong tone. | All screens | Bad: "Coaching Style ⓘ" with click-to-explain. Good: "Coaching Style" with AI explaining when asked. | Yair's product decisions | Active |
| UX-09 | Both voice and text/tap always work | Every action in the app can be done via voice OR text/tap. Voice is preferred but never the only path. If mic denied or voice broken, user can still complete every flow. | All screens | User denies mic at MIC-PERMISSION → onboarding still completes via taps + typing through Direct LLM path. User taps habit complete instead of saying it → still works. | Voice Journey doc + P1-27 | Active |
| UX-10 | Friction removal not fragmentation | Position Guided Growth around removing friction from habit formation, NOT "replacing 5-7 apps" or "solving fragmentation". The voice-first model exists to make checking in feel like chit-chatting, not homework. | All screens, all coaching responses, all marketing copy | Bad: "Replace your 7 habit apps." Good: "Two minutes of conversation, no taps required." Bad: "All your data in one place." Good: "It feels like talking to a friend who actually remembers." | Yair's positioning decisions | Active |
| UX-11 | AI insights only at 3+ data points | The LLM does NOT generate insights, patterns, or correlations until ≥3 supporting data points. Before that, show "Keep checking in — insights appear after a week." Speculation from 1-2 data points damages trust. | INSIGHTS-ANALYTICS, evening check-ins, weekly summaries | After 2 days: no insight. After 3 days of poor sleep + low mood: "I've noticed your mood is lower on days following less than 6 hours of sleep." Confidence comes from data. | AI Coaching Framework + P1-45 | Active |
| UX-12 | Voice conversation cap (silent) | Voice conversations beyond morning/evening check-ins are capped at 5 per day. Cap is silent — no counter shown. When reached, show VOICE-CAP message: "You've used your voice sessions for today. I'll be here tomorrow." Check-ins NEVER count. Resets at midnight in user's timezone. | CHAT, VOICE-CAP | User does morning check-in (free), 5 voice convos, then taps mic again → VOICE-CAP plays. Evening check-in still free. | Voice Journey doc + Phase 2 spec | Active |
| UX-13 | Coaching response brevity | Coaching responses are short by default. Morning: 1-2 sentences. Evening: 2-3. Voice convos: 4-5 max. No speeches. Exception: welcome MP3 (~60s) and milestone moments. | All LLM-active screens, all coaching responses | Bad: 5-paragraph reflection on user's stress. Good: "That sounds heavy. What's the main thing weighing on you?" Bad: long monologue at evening. Good: "Three out of four today. Solid day. Rest well." | AI Coaching Framework | Active |
| UX-14 | Coaching style: Warm & Thoughtful (MVP) | MVP uses a single coaching style: Warm & Thoughtful. Other styles (Honest & Direct, Calm & Reflective) are post-MVP. Do NOT show coaching style selector in MVP settings. Default and only option. | All LLM-active screens, SETTINGS | Settings does NOT show "Coaching Style" selector for MVP. Post-MVP: dropdown with 3 styles. | Voice Infrastructure + Yair's decisions | Active (MVP only) |
| UX-15 | User can pause onboarding ("Come back later") | At critical onboarding decision points, user can tap "Come back later" to pause and resume. State saved in `onboarding_state`. AI does not nag. POST-AUTH-SIGNUP [DEPRECATED] is now LLM-active so come-back-later is presented within the live conversation rather than MP3 prompt + button. | POST-AUTH-SIGNUP [DEPRECATED], ONBOARD-* screens | User taps "Come back later" at welcome. Next open: "Hey — you're back. Ready to set up?" continues where they left off. | Voice Journey doc + POST-AUTH-SIGNUP spec | Active \| Updated v2 plan May 2026 |
| UX-16 | Mic timeout — 8s system gray, sticky user-off | Once mic granted, stays listening during active sessions. After 8s of silence, mic auto-grays (system idle) — NOT off, just quiet. ANY user interaction (tap, scroll, navigate) reactivates it. EXCEPTION: if user manually taps mic off, that off-state is sticky — interactions do NOT auto-reactivate. Two distinct off-states: SYSTEM-gray (auto) vs USER-off (sticky). | All screens with active mic | — | UX_Rules_v3 (GLOB-02/03/04) | Active (added v2 plan) |
| UX-17 | AI button — voice/text mode toggle | AI button has two modes: voice (AI speaks via TTS) or text (AI writes only). User picks default at VOICE-PREFERENCE. Toggle anytime. Voice → text flip cuts AI audio immediately (no finish-the-sentence). Text mode + chat overlay closed → AI text appears as subtitles overlay (user can minimize). | All screens with AI presence | — | UX_Rules_v3 (GLOB-07/08/09) | Active (added v2 plan) |
| UX-18 | Chat overlay is transcript-only | Chat overlay is purely a visual transcript view. Open = user sees the conversation transcript. Closed = transcript hidden, conversation continues. Chat state has ZERO effect on whether AI is talking — controlled by AI button (voice/text mode), not chat. AI keeps talking with chat closed. Chat opens by default during onboarding and auto-closes ONCE on first home arrival; afterward user controls. | All screens | — | UX_Rules_v3 (GLOB-11/12/13) | Active (added v2 plan) |
| UX-19 | Tooltip — sequential spotlight tour on first home arrival | First time on home, after 5s orientation pause, run sequential spotlight tour for TT-01..TT-08 (each tooltip points at one home element, user taps Next to advance, skippable). Other screens use auto-dismiss tooltips (TT-09..TT-12, dismiss after 4s or interaction). All tooltips show ONCE per screen per account, never again. User can replay tutorial from Settings. | HOME-FIRST (sequential), all other screens (auto-dismiss) | — | UX_Rules_v3 (GLOB-18/19/28/30/31) + Tooltip_list_v5 | Active (added v2 plan) |
| UX-20 | Anonymization — `anon_id` everywhere downstream | Identity (email, name) is separated from behavior. Every user has an `anon_id` (UUID) generated at signup. `session_log`, habits, checkins, journal_entries, PostHog all keyed to `anon_id`, NEVER `user_id` or email. LLM context never includes email or last name (first name OK for personalization). Bridge between user_id and anon_id lives in user_profiles only, locked down via RLS to backend services. See `P1-46`. | All backend services, LLM context builder, PostHog wiring | — | v2 MVP plan | Active (added v2 plan) |
| UX-21 | Async reflection check-in pattern (NOT Vapi) | Daily check-ins use the async reflection pattern, NOT Vapi. Flow: Yair MP3 prompt → user voice dump (Soniox STT) → MP3 thinking acknowledgment → LLM processes (2-3s) → personalized response in Yair cloned voice via Cartesia Sonic API → optional follow-up → closing matched to mood. Cost ~$0.006/check-in. Vapi reserved for onboarding (live conversation) and feedback sessions (scheduled triggers). | MCHECK-01, MCHECK-02, ECHECK-01..06 | — | v2 MVP plan | Active (added v2 plan) |
| UX-22 | Voice + text sync (Option A) | When AI speaks (voice mode), corresponding text appears alongside audio in chat thread or subtitles overlay. Approximate timing — text appears as AI starts speaking, not word-by-word lipsync. Word-by-word karaoke-style via Cartesia Sonic `add_timestamps` is post-MVP. For Phase E launch, simple parallel display is enough. | All screens with AI voice output | — | v2 MVP plan | Active (added v2 plan) |
| UX-23 | Feedback sessions — Vapi at scheduled triggers | Feedback collection happens via Vapi voice sessions at scheduled triggers: 1 week after signup, 1 month after signup, plus manual button on settings. ~7 minute open-ended conversations where AI asks how the app is going, what works, what doesn't. Reuses onboarding Vapi plumbing — same agent infrastructure, different system prompt. See `P2-31`. | Settings (manual trigger) + scheduled cron jobs | — | v2 MVP plan | Active (added v2 plan) |

## Refresh

```
mcp__google-sheets__get_sheet_data(
  spreadsheet_id="1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw",
  sheet="UX Rules"
)
```

Trigger: "refresh app-ux-rules" or "resync the sheet".

_Last refreshed: 2026-05-11_
