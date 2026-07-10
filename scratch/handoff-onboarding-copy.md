PLEASE INJECT IN THE ONBOARDING-COPY SESSION (AI).  [session id: onboarding-copy]

Purpose: this is the ONE place Yair answers every open onboarding COPY decision, especially the conversation copy. Gather everything not reconciled, present it as clean specific choices, and capture his answers into a locked doc that the fill build session and the app-reconcile both consume. Yair works through it here. On start, connect to Mattermost (GG_SESSION=onboarding-copy, presence to ai-sandbox).

CANONICAL BRANCH: fix/contract-honesty (the tip: render + machinery + F1' + honesty slice). Confirm the exact head with the conductor on ai-yair before reading openers.

READ FIRST (ground every question in the REAL current copy, do not invent):
- gg-spec/docs/onboarding-dynamic-replies-spec-2026-07-09.md  (the full reply menu: conversation branches + reactive lines + its 4 open decisions)
- The render openers + section-13 branches in src/components/flow-designer/beatsSource.ts on fix/contract-honesty
- scripts/check-app-parity.mjs output for the 7 render-vs-app opener mismatches: profile, fork, category, habits, advanced capture, reflection
- gg-spec/docs/onboarding-copy-flow-rules.md  (voice rules: warm, one line, no platitudes, no praise-the-pick, no machinery words, improv OFF, no em dashes)

PRESENT TO YAIR AS DECISIONS (capture answers verbatim, quotable):

1. THE 7 OPENER RECONCILES. For each drifted screen, show render opener vs app opener side by side, ask which is canonical or the corrected line. These become the source-of-truth openers. (Locking these EARLY is what keeps the fill from needing rework, so do this section first.)

2. VERBATIM OPENERS PER BEAT. The main scripted opening line for each beat where the wording is still open, including the state-check opener (Yair was moving it toward an invite to a coaching process, confirm the exact line).

3. THE CONVERSATION BRANCHES (section-13, the ones Yair is working on). Per beat, the scripted branch replies the coach can pick from: help-you-decide (user unsure), which-is-most-urgent (user names several), vague-then-pin (user is vague), create-your-own (off-list), and any other conversational turn per beat. Improv is OFF, so every branch runs on a small pre-written set. Capture the picked + Yair-added lines per branch, per beat.

4. THE REACTIVE / GLOBAL LINES + the spec's 4 decisions. Off-topic steer-back (global set + per-beat), tool-failure, invalid-value / re-ask, max-turns, empty-state. Walk the 4 open decisions: modality (spec recommends recorded shared-set + per-beat scripted), rotation depth (alternates per family so repeats do not sound robotic), keep / reword / cut per line, clip-family naming. Give Yair room to ADD his own options, he wants a plethora.

5. GENDER ENUM WORDING. Confirm Female / Male / Other, replacing woman / men / non-binary / undisclosed.

6. CATCH-ALL. Any other per-beat copy the fill surfaces as ambiguous.

DELIVER: write his locked answers to gg-spec/docs/onboarding-copy-decisions-2026-07-10.md, organized by these 6 sections, each line final and quotable. Post the doc path to ai-yair when a section locks so the fill can consume it. Do NOT edit beatsSource or generate audio, copy decisions only.

NOTE: parity (the render-vs-app match) and the dynamic-reply audio are Yair's parallel tracks, not blockers here. This session just locks the words.
