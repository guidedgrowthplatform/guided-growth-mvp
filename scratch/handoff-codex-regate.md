PLEASE INJECT IN THE CODEX QA SESSION (AI, Codex/GPT-5.6).  [session id: codex-qa]

You are the second-model re-gate on the Guided Growth onboarding contract. Yair is driving you directly, so do NOT depend on Mattermost. Report by writing a doc + telling Yair in this session (also post to ai-yair if your watcher happens to be up).

REPO: guided-growth-mvp (self-hosted GitLab, guidedgrowth-group). Pull origin/fix/contract-honesty and note the head hash. Your last gate was on d2959292.
- If the head is STILL d2959292, the fix has not landed yet: build the harness below, baseline it, then wait for Yair to tell you the fixed head is in.
- If the head is NEWER: run the full re-gate immediately.

YOUR TWO PRIOR BLOCKERS (both must close):
- B1-R: all 7 non-sleep goals variants (goals-move/eat/energy/stress/focus/break/organize) resolve about 14 head-category "sleep" remnants each through resolveBeatStructure(), in the derived sections: rulesContext, conversation.branches voice, edges.rows voice, clip-family roots onboard_goals_sleep_*, downstream flow examples. goals-move DOES get the fresh Move opener/clip/tiles, that part is fine; the rest still leaks. The leak guard only scans exact tokens (Sleep better + known clip ids), so it passes green while the resolved contract is category-wrong.
- F1-R: removing the glob-out-of-scope voice owner passes the audio-ownership check (it skips a global rule with no voice field, scripts/checks/audio-ownership-check.mjs:213). The TOOL_FAILURE voice-path line (src/components/flow-designer/flowBible.ts:131) is plain prose that no lane reads. So the exact global dynamic replies F1' says must be owned can be left unowned with the check green.

BUILD THIS HARNESS (works on any head):
1. ALL-VARIANT SEMANTIC SCAN: resolve all 7 non-sleep goals variants through the production resolveBeatStructure() and count ANY head-category remnant, case-normalized "sleep", clip-family roots "onboard_goals_sleep", category example labels, and category route ids, across every derived section.
2. TWO NEGATIVE TESTS: (a) remove the glob-out-of-scope voice owner, run the audio-ownership check, it MUST fail; (b) remove or corrupt the TOOL_FAILURE voice owner, it MUST fail. Revert each.

BASELINE (on d2959292): the scan MUST report about 14 remnants each, and both negative tests currently PASS (the bug). That proves your harness detects the real defects.

GREEN BAR (on the fixed head): the scan hits ZERO remnants across all 7 variants, AND both negative tests now FAIL the build. Also re-confirm the prior closures still hold: real 62-beat 14-key manifest coverage, goals-sleep components = pending-app-reconcile, all 4 original guards still bite, npm run check:beats (12) green, and the release-mode gate honest.

DELIVER: write the verdict (SCALE-READY / NOT-READY) with before/after numbers + file:line proof to gg-spec/docs/whole-system-onboarding-qa-CODEX-regate2-2026-07-10.md, and tell Yair in this session. If NOT-READY, list the exact residual + fix. Be adversarial. No code changes by this QA session.
