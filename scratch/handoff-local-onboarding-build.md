# Local onboarding-build session set (Yair's machine)

The onboarding build is now local. These three sessions run on Yair's own accounts + Codex, coordinated by the conductor over Mattermost. Side-projects (calendar, parental controls) stay with the team. Parity is Yair's parallel track.

Current state on the self-hosted GitLab (guidedgrowth-group/guided-growth-mvp):
- Canonical trunk: swarm/integrate @ d0cfb06e.
- F1' voice-ownership PUSHED on top: origin/f1prime/voice-ownership = c3c38fe5 + e007a36c, fast-forward on d0cfb06e.
- Honesty slice: origin/fix/contract-honesty (stacked on the F1' head), being pushed now. Get the exact head from the conductor on ai-yair.

---

## A. onboarding-build  (Yair's main/other Claude account, Opus, high effort)

```
PLEASE INJECT IN THE ONBOARDING-BUILD SESSION (AI, Opus/high).  [session id: onboarding-build]
You own the onboarding Bible/structure lineage locally. Connect to Mattermost (GG_SESSION=onboarding-build, presence to ai-sandbox). Coordinate with the conductor on ai-yair.

REPO: guided-growth-mvp (self-hosted GitLab). Pull origin/fix/contract-honesty (F1' + the honesty slice; get the head from the conductor). Work in a local worktree. Push to that same branch; the conductor gates merges.

STEP 1 - FINISH + VERIFY THE HONESTY SLICE (close Codex NOT-READY):
- B1: resolveBeatStructure() must return a complete 14-key pending manifest for EVERY beat (runtime + render, not just the check script), render the 14 status rows (or a complete virtualized list), and a test against the PRODUCTION resolver asserting 62 manifests x 14 keys + 62 status cards.
- B2: goals-sleep components -> pending-app-reconcile in head + ALL derived variants (goalsList.tsx does not implement the n-of-2 counter or Continue). The scale/release gate must REJECT a filled components section that carries an asserted-but-unimplemented note. Push component-registry-check toward a runtime/DOM assertion.
- S1 gender vocab woman->Female/Male/Other; S2 VoiceMode Verbatim|Improvise|null -> Verbatim|Generative (map legacy Improvise once, incl the reaction beats); S3 the badge computed from the 14-key manifest.
- Rerun the F1' negative test on this candidate (strip a dynamic-reply voice field, audio-ownership-check must fail, revert).
GATE: tsc clean, vitest green, check:beats (12) green, bible-registry authoring clean + --mode=release rejection proven. Push, post the head to ai-yair. The conductor runs the two-model re-gate on it.

STEP 2 - THE FILL (only after the conductor says both models re-gated GREEN):
Fill the 12-section (14-key) Bible for EVERY beat off the 8 exemplars: coach-greeting, sign-up, category-women, goals-sleep, profile-asks, splash, mic-permission, state-check. Rules: every beat resolves a manifest with all 14 keys owner-filled / derived / {na:reason} / pending-app-reconcile (no pending-fill); variants DERIVE not clone (leak guard); voice-ownership per F1' (clip-family pending-recording is fine); coach voice warm/one-line/no-platitudes/no-praise/no-machinery-words, improv OFF, NO em dashes. Consume gg-spec/docs/onboarding-copy-decisions-2026-07-10.md for the locked openers. Push to fill/all-beats, post ready-for-QA to ai-yair. Do NOT self-merge.
```

---

## B. onboarding-qa-fable  (Yair's Fable)

```
PLEASE INJECT IN THE FABLE QA SESSION (AI, Fable).  [session id: onboarding-qa-fable]
Connect to Mattermost (GG_SESSION=onboarding-qa-fable). Two jobs, adversarial, run everything yourself.

JOB 1 - RE-GATE the honesty-slice head (origin/fix/contract-honesty, head from the conductor). Confirm Codex's 3 blockers are closed: B1 the resolver returns a real 14-key manifest for all 62 beats + render shows them (not a synthetic count); B2 goals components is pending-app-reconcile not filled, and the gate rejects a filled-on-unbuilt claim; and every guard still bites (mutation-test the leak guard, the filled-claim guard, the second-source guard, the F1' audio-ownership guard). Verdict SCALE-READY / FIX / NOT-READY, findings + file:line + proof, to a doc + post to ai-yair.

JOB 2 - after the fill lands (branch fill/all-beats), adversarially QA it: coverage 62/62 all real (0 pending-fill), every guard green + bites, per-beat copy matches its screen + context, variants carry OWN facts (no head-beat leak), dynamic replies voiced per F1', improv OFF, no em dashes/platitudes. Verdict + proof to ai-yair.
```

---

## C. onboarding-qa-codex  (Yair's local Codex, GPT-5.6)

```
PLEASE INJECT IN THE CODEX QA SESSION (AI, Codex/GPT-5.6).  [session id: codex-qa]
You are the second-model re-gate. Your prior verdict on d0cfb06e was NOT-READY (3 blockers: synthetic-only coverage, goals filled-on-unbuilt, red/nonblocking/narrow parity). Report: ~/Developer/gg-spec/docs/whole-system-onboarding-qa-CODEX-2026-07-10.md.

RE-TEST the honesty-slice head (origin/fix/contract-honesty, head from the conductor on ai-yair, which now stacks F1' + the B1/B2/S1-3 fixes). Confirm:
- B1 CLOSED: resolveBeatStructure() returns a real 14-key manifest for all 62 beats and the render shows them, not a guard-synthesized count.
- B2 CLOSED: goals components is pending-app-reconcile (not filled), and the gate rejects a filled section carrying an asserted-but-unimplemented note.
- F1' now merged into the candidate: VOICE_OWNERSHIP present, audio-ownership-check covers 4 lanes, its negative test bites.
- All prior mutations still bite.
- Parity (B3) is Yair's parallel track; note its state but it does NOT block this re-gate.
Then hunt for anything NEW that would multiply at 40x. Write the verdict (SCALE-READY / SCALE-WITH-CHANGES / NOT-READY) with proof to a fresh dated CODEX doc, and post a one-line verdict + path to ai-yair. Be adversarial.
```
