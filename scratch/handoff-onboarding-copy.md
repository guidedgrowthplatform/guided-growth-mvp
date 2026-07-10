PLEASE INJECT IN THE ONBOARDING-COPY SESSION (AI).  [session id: onboarding-copy]

Purpose: this is the ONE place Yair answers every open onboarding COPY decision. Your job is to gather everything that is not reconciled, present it to Yair as clean, specific choices, and capture his answers into a locked doc that the fill build session and the app-reconcile both consume. Yair will sit in this session and work through it. On start, connect to Mattermost (GG_SESSION=onboarding-copy, presence to ai-sandbox).

READ FIRST (ground every question in real current copy, do not invent):
- gg-spec/docs/onboarding-dynamic-replies-spec-2026-07-09.md  (the dynamic-reply line options + its 4 open decisions at the bottom)
- The render openers in src/components/flow-designer/beatsSource.ts on the canonical trunk (confirm the head with the conductor on ai-yair)
- scripts/check-app-parity.mjs output for the 7 render-vs-app opener mismatches (run it, or get the list from the conductor): profile, fork, category, habits, advanced capture, reflection
- gg-spec/docs/onboarding-copy-flow-rules.md  (the voice rules: warm, one line, no platitudes, no praise-the-pick, no machinery words, improv OFF, no em dashes)

PRESENT TO YAIR AS DECISIONS (one clean set, his answers captured verbatim):

1. THE 7 OPENER RECONCILES. For each of the 7 screens where the render copy and the app copy have drifted, show him the render opener side by side with the app opener and ask which is canonical, or the corrected line. These become the source-of-truth openers.

2. DYNAMIC REPLY OPTIONS (Yair wants to be on this + expand it). Walk the dynamic-replies spec's 4 open decisions: (a) modality (spec recommends recorded shared-set + per-beat scripted), (b) rotation depth (how many alternates per family so repeats do not sound robotic), (c) which lines to keep / reword / cut, (d) the clip-family naming. Give him room to ADD his own line options per family, he wants a plethora to choose from. Capture the final picked + added lines per family (global + per-beat).

3. GENDER ENUM WORDING. Confirm the copy uses Female / Male / Other (the locked product enum), replacing the old woman / men / non-binary / undisclosed wording.

4. PER-BEAT VERBATIM OPENERS where the wording is uncertain, including the state-check opener (Yair was moving it toward an invite to a coaching process, confirm the exact line).

5. CATCH-ALL. Any other per-beat copy the fill surfaces as ambiguous goes here for his ruling.

DELIVER: write his locked answers to gg-spec/docs/onboarding-copy-decisions-2026-07-10.md, organized by the 5 sections above, each line final and quotable. Post the doc path to ai-yair when a section is locked so the fill build session can consume it. Do NOT edit beatsSource or generate audio, this session is copy decisions only.

NOTE: parity (the render-vs-app match) and the dynamic-reply audio are Yair's parallel tracks, not blockers to this. This session just locks the words.
