# Leg 2 Execution Plan (staged while Codex re-gates leg 1 on 56eb07fa)

Read-only scoping. Sources: HANDOFF-onboarding-finish-line, HANDOFF-render-parity-gate, HANDOFF-system-audit, system-audit/REPORT.md, HANDOFF-gg-conductor.

## 1. STATE NOW

| Workstream | Status |
|---|---|
| Render internal cleanup (2 copy stores -> 1) | PENDING. Audit #2: BEATS props vs onboardingMetadata.json still two stores. Feeds off Yair's Decisions-tab (Sheet 1iNE..., gid 1231166888). |
| Publish clean /parity.json | LIVE-CORRECTION (fact-checked 2026-07-11 by conductor): gg-onboarding-render.pages.dev/parity.json is ALREADY serving real JSON (content-type application/json, beats payload from beatsSource.ts#BEATS_SOURCE), NOT the HTML fallback the handoff described. The export IS deployed. Open question is only whether the live JSON reflects the CLEANED render or a pre-cleanup one. This means gate 2 below is at least partly done; re-check after render cleanup that the live JSON matches. |
| Parity CI flip to blocking | REPORT-MODE. !510 (codex/render-parity-gate) draft, allow_failure:true by design. Flip gated on !507 landing + main matching render. |
| !507 reconciliation (app order/copy -> render) | HELD by Yair. Was GO on all 4 gates pre-hold; must re-run against the CLEANED render. Branch fix/onboarding-render-reconcile. |
| App flow/copy/context/audio reconcile | PENDING, waits on cleaned render + republished parity.json. |
| Source-integrity guards | NOT STARTED. Separate required CI job (source_integrity) per audit #4-9,#11. |
| Atomic screenId->beatId rename | MAP READY, NOT EXECUTED. claude-work/rename-map/RENAME-MAP.md (25 beats, 0 flags). ~500 refs across app code, Supabase screen_contexts, Sheet screen_id col, Vapi config, /voice/ob/*.wav filenames, nav, session_log. One atomic guarded pass. |
| Acceptance round | Framework defined (per-change/per-beat/per-release), not yet run against clean+renamed build. |
| Release chain | Parked behind above; runbook gg-spec/docs/release-runbook-2026-07-05.md. |

## 2. GATE ORDER (MR-sized slices)

1. Render internal cleanup: apply closed bible/Decisions content, collapse to one canonical copy store, consistency check green. Done when: single store, redeploy live. Verify: rebuild + consistency check + diff vs confirmed Decisions rows.
2. Deploy render -> clean /parity.json live: deploy cleaned flow-annotated-render / !509. Done when: JSON not HTML at live URL. Verify: curl -fsS .../parity.json | jq.
3. Re-run !507 against clean export, merge: re-diff held branch vs fresh parity.json, re-walk 4 gates. Done when: green pipeline + browser-walk GO, merged. Verify: render-parity-check.mjs passes live.
4. Flip render_parity to blocking: allow_failure:false on !510. Done when: drifted test MR fails CI, clean one passes. Verify: red/green pair.
5. Build source-integrity guards: one check per audit gap (fallback activation, generated-file staleness, screen_contexts legacy path, allowedTools ownership, audio ownership, prose-only). Done when: each fails on reintroduced violation, passes clean. Verify: red/green per guard.
6. Execute atomic rename: RENAME-MAP.md as one guarded pass across ~500 refs incl Supabase, Vapi, audio filenames. Done when: zero broken id links, render_parity + source_integrity green post-rename. Verify: guards + live session-resume walk.
7. Full acceptance round: AI fleet + per-beat table (Shows/Says/Advances/Survives-refresh, Beat 3-17 + projections) + Yair human walkthrough, console open. Done when: clean round, zero unaddressed regressions. Verify: fleet scorecard + Yair sign-off in ledger.
8. Release: strip QA flags, Sentry test event, promote main->production, Vapi turn-taking patch. Done when: prod live. Verify: prod smoke walk + Sentry event + Vapi check.

## 3. BLOCKERS / DECISIONS

- Google Drive quota (both Yair accounts) blocks new Sheet/Doc artifacts, needs the Shared Drive fix (handed off separately).
- 6 architectural rulings still need explicit confirm (recommendations on file): epoch rule (render vs future flow-builder-export as ultimate truth), screen_contexts retire-vs-fallback, allowedTools ownership, voice rule in machine terms, source-integrity guard CI placement, women's-category-variant folding into pick-category.
- 8 per-category coach lines: Yair must write/approve before recording in his voice, blocks audio-ownership closure for those clips.
- Deploy approval needed to push render branch live (external Cloudflare Pages step).
- Conductor merge gate on !507/!509/!510 + future guard MRs (single-conductor rule).
- Rename touches Vapi config + /voice/ob/*.wav, deliberate handling not pure find-replace.

## 4. FASTEST FIRST MOVE

Restart the render-cleanup pass with the closed bible as input, and redeploy. Closes gate 1 AND gate 2 at once (a render redeploy auto-republishes /parity.json per the finish-line handoff). It is the dependency every other gate stalls behind: !507 can't be honestly reconciled until parity.json reflects the cleaned render, the CI gate stays a no-op until then, and rename/guards/acceptance are pointless against an unstable render. Already-staged work, not new scoping.
