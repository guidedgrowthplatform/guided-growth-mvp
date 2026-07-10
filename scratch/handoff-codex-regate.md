PLEASE INJECT IN THE CODEX QA SESSION (AI, Codex/GPT-5.6).  [session id: codex-qa]

AFTER-FIX RE-GATE. The two blockers you found are fixed and pushed. Run your after-fix gate now and give the verdict. Yair is driving you directly, so do NOT depend on Mattermost; report by writing a doc + telling Yair in this session.

REPO: guided-growth-mvp (self-hosted GitLab, guidedgrowth-group). Pull origin/fix/contract-honesty. The head is now a8e57b92 (was d2959292, your NOT-READY baseline). If the head is not a8e57b92, pull again.

WHAT CHANGED (verify each, do not take on faith):
- B1-R: the category-sensitive goals sections (rulesContext, conversation, flow, edges) are now built from TYPED per-category data, not free-text substitution. A resolver-level semantic leak scan + an all-variant mutation test + a head/builder parity lock were added.
- F1-R: a GLOBAL_VOICE_OWNERSHIP registry now requires a legal-shape owner for every global dynamic spoken response, TOOL_FAILURE gained a typed voicePath owner, and the audio-ownership check requires ownership per registry entry (not validate-if-present).
- F3-R: component-registry-check is now a real render assertion, independent of the deletable ASSERTED-SPEC marker.

RUN YOUR HARNESS (the one you built and baselined at 98 remnants / both negatives passing):
1. All-variant semantic scan across the 7 non-sleep goals variants through the production resolveBeatStructure(). GREEN = ZERO head-category remnants (down from 98). goals-move must still resolve its own Move opener/clip/tiles/route.
2. The two negatives: (a) remove the glob-out-of-scope voice owner -> the check MUST now fail; (b) remove/corrupt the TOOL_FAILURE voice owner -> MUST now fail. Revert each.
3. Confirm prior closures still hold: real 62-beat 14-key coverage, goals-sleep.components = pending-app-reconcile, the 4 original guards still bite, npm run check:beats (12) green, release mode honest.
Note: src/lib/icons/iconBundle.test.ts fails identically on the old head (pre-existing, unrelated), ignore it.

DELIVER: write the verdict (SCALE-READY / NOT-READY) with the before/after numbers (98 -> ? remnants, negatives pass -> fail) and file:line proof to gg-spec/docs/whole-system-onboarding-qa-CODEX-regate3-2026-07-10.md, and tell Yair in this session. If SCALE-READY, say so plainly, that clears the fill. If NOT-READY, list the exact residual + fix. Be adversarial. No code changes by this QA session.
