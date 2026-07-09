# GitLab Self-Hosted Sweep (2026-07-09)

**Scan timestamp:** 2026-07-09 ~20:30 IDT  
**Scope:** last ~2 days (2026-07-07 onward)  
**Instance:** https://gitlab.guidedgrowthapp.com  
**Project:** guidedgrowth-group/guided-growth-mvp

---

## Summary

**Open MRs:** 47 total (24 draft, 23 ready to merge)  
**Recently merged:** 15 MRs in the last 48 hours  
**Key branch activity:** flow-annotated-render, annotate/sample-category-women, all-flows-one-source-render all active  
**Azure/CI:** !530 (Azure OpenAI provider to production, inert, draft); !529 MERGED (Azure LLM_PROVIDER flag); !521 CI wire-render-guards; !514 source-integrity guards

---

## Open MRs — Render & Onboarding Chain (Highest Churn)

### Critical Path — Render Variants & Bible Fill

| !iid | Title | Branch | Draft | Updated | Status Notes |
|-----|-------|--------|-------|---------|--------------|
| !532 | render structure: GLOBAL layer + section 13 + variantOf + io contracts + files/sync map | structure/global-layer → annotate/sample-category-women | ✓ | 2026-07-09 18:24 | **BLOCKER:** Targets annotate/sample-category-women, which is ITSELF a branch with live commits. Complex dependency chain. |
| !531 | Bible fill — beat 13 (goals-sleep) [shape test] | annotate/bible-fill-all → annotate/sample-category-women | ✓ | 2026-07-09 17:52 | **TARGET MOVING:** targets annotate/sample-category-women (also taking !532). Likely stale/conflict-prone. |
| !523 | render: comprehensive variant-beat fix (collapse + switcher + reveal gate + profile split) | render/collapse-variants → flow-annotated-render | ✓ | 2026-07-09 10:45 | Variant fix. Targets flow-annotated-render which has active merges. |
| !522 | Annotate 4 exemplar onboarding beats + rules self-audit (shape-setter) | annotate/exemplar-beats → flow-annotated-render | ✓ | 2026-07-09 01:11 | Audit branch, 4 exemplar beats annotated. |
| !515 | Render all flows one source rules | all-flows-one-source-render → flow-annotated-render | ✓ | 2026-07-08 22:56 | ONE-SOURCE rendering rules. Branch all-flows-one-source-render exists and has recent commits. |

### Audio & Voice

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !527 | Onboarding audio - 110 habit-ack clips + 4 shorten re-records | feat/onboarding-habit-ack-audio → all-flows-one-source-render | ✓ | 2026-07-09 12:42 | 110 habit-ack clips. Targets all-flows-one-source-render (actively built). |
| !525 | fix(onboarding): sync coach-greeting audio timing, align live Cartesia voice | fix/render-voice-beats-3-6 → flow-annotated-render | ✓ | 2026-07-09 09:35 | Voice timing sync. Cartesia voice alignment. |
| !518 | onboarding voice clips (42) + coach_greeting rename | onboarding-mp3-voice-clips → flow-annotated-render | ✓ | 2026-07-08 21:31 | 42 voice clips. Targets flow-annotated-render. |
| !520 | fix(voice): lock generate-voice-mp3s.mjs to onboarding-mp3 preset | fix/voicegen-locked-preset → main | ✓ | 2026-07-08 22:21 | Voice generation preset lock. |

### LLM & Behavior

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !528 | Onboarding LLM cost: gpt-4o only on tool turns, else mini | fix/onboarding-model-cost → main | ✓ | 2026-07-09 14:48 | Cost optimization: gpt-4o only on tool turns, gpt-4 mini otherwise. |
| !526 | onboarding behavior rules enforcement (rules 1,2,4/5,6,7 green; rule 3 deferred) | feat/onboarding-behavior-rules → main | ✗ | 2026-07-09 10:26 | **READY TO MERGE** (not draft). 6 of 7 rules green. Rule 3 deferred to flow-reconcile (!507). |
| !519 | Add VITE_QA_STUB_TTS cost guard to stub live Cartesia for fleet QA | feat/qa-stub-tts → main | ✓ | 2026-07-08 21:53 | QA cost guard: stubs Cartesia TTS for fleet testing. |

### Render Structure & UI

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !524 | render: move beat play control out of the phone into the beat header | fix/play-button-to-header → flow-annotated-render | ✓ | 2026-07-09 09:34 | UI structure: play button → header. |
| !509 | Add render parity export | flow-annotated-render → main | ✓ | 2026-07-09 00:57 | **CRITICAL:** parity export (from HANDOFF-render-parity-gate.md). Targets main. |
| !521 | ci: wire render guards into CI (report mode) | ci/wire-render-guards → flow-annotated-render | ✓ | 2026-07-08 23:16 | CI gates for render. Report mode (not required yet). |
| !514 | ci(render): source_integrity guard + required CI job | feat/source-integrity-guards → flow-annotated-render | ✓ | 2026-07-08 20:20 | Source-integrity CI job. Required gate. |

### Cleanup & Perf

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !516 | chore: prune dead/over-exported symbols (knip Zone A) | chore/knip-export-sweep → main | ✗ | 2026-07-08 20:33 | **READY TO MERGE** (not draft). Dead-code cleanup. |
| !489 | perf(voice): pre-mint Soniox key + pre-open WS at mic-permission grant | latency-fix-soniox-premint-2026-07-07 → main | ✓ | 2026-07-07 20:46 | Soniox perf optimization. Pre-warm key. |

### Azure, OpenAI, Provider

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !530 | Azure OpenAI provider onto production (inert, cost migration) | chore/azure-provider-to-production → production | ✓ | 2026-07-09 17:20 | **BLOCKED:** targets `production` branch (not main). Marked inert / cost-migration only. DRAFT. |
| !529 | Azure OpenAI provider behind LLM_PROVIDER flag (default openai) | feat/llm-provider-azure → main | **MERGED 2026-07-09 15:47** | — | Azure provider behind flag (default = OpenAI). Flag-gated. |

### Unclassified / Older

| !iid | Title | Branch | Draft | Updated | Status |
|-----|-------|--------|-------|---------|--------|
| !507 | Reconcile onboarding flow to the render (order + copy) | fix/onboarding-render-reconcile → main | ✓ | 2026-07-07 20:49 | **CRITICAL:** flow/render reconciliation. Blocks release gate. |
| !505, !504, !502, !506, !508 | Voice fixes (double-arm, corrections, silent coach, gender) | — → main | **MERGED 2026-07-07/08** | — | Audio ownership, coach silence, corrections all merged. Clean. |

---

## Branch Activity (Last 48 Hours)

**Flow-rendering branches (actively built):**
- `flow-annotated-render` — 5 commits in 24h, newest 2026-07-09 03:53 (copy logic, L7/L5/L3 beats)
- `all-flows-one-source-render` — 5 commits, newest 2026-07-09 00:27 (flow layer + play controls)
- `annotate/sample-category-women` — 5 commits, newest 2026-07-09 16:31 (Bible card fold, category-women fill, accordion UI)
- `annotate/bible-fill-all` — push timestamp 2026-07-09 20:51
- `annotate/exemplar-beats` — last 2026-07-09 04:10

**Provider/feature branches:**
- `feat/llm-provider-azure` — commit 2026-07-09 18:01 (MERGED to main 15:47)
- `feat/onboarding-habit-ack-audio` — commit 2026-07-09 15:41
- `feat/onboarding-behavior-rules` — commit 2026-07-09 10:26 (READY to merge)
- `chore/azure-provider-to-production` — commit 2026-07-09 20:19 (draft !530, targets `production` branch)

**CI/QA branches:**
- `ci/wire-render-guards` — commit 2026-07-09 02:15
- `codex/render-parity-gate` — commit 2026-07-07 23:34

---

## Recently Merged (Last 48 Hours)

| !iid | Title | Branch | Merged | Target |
|-----|-------|--------|--------|--------|
| !529 | Azure OpenAI provider behind LLM_PROVIDER flag | feat/llm-provider-azure | 2026-07-09 15:47 | main |
| !517 | render onboarding one-source finisher (copy + logic + clips) | feat/onboarding-render-copy-logic | 2026-07-09 00:57 | flow-annotated-render |
| !513 | chore: remove orphaned api/_lib/gitlab.ts | chore/remove-gitlab-status | 2026-07-08 16:43 | main |
| !511 | chore: remove dead code + knip register | chore/knip-cleanup | 2026-07-08 16:43 | main |
| !508, !505, !504, !502, !506, !498-501 | Voice fixes (double-arm, corrections, silent coach, orb, reflection) | fix/* | 2026-07-07-08 | main |

---

## Key Branches — Commit History (Last 5)

### `main`
```
2026-07-09 15:47  Merge branch 'feat/llm-provider-azure' into 'main'
2026-07-09 18:01  Add Azure OpenAI provider behind LLM_PROVIDER flag (default openai)
2026-07-08 16:43  Merge branch 'chore/remove-gitlab-status' into 'main'
2026-07-08 16:43  Merge branch 'chore/knip-cleanup' into 'main'
2026-07-08 16:14  chore: remove orphaned api/_lib/gitlab.ts
```

### `flow-annotated-render`
```
2026-07-09 00:57  Merge branch 'feat/onboarding-render-copy-logic' into 'flow-annotated-render'
2026-07-09 03:53  render(onboarding): absorb voice clips, wire all clip references
2026-07-09 03:51  render(onboarding): L7 plan-review buttons on the plan confirm beat
2026-07-09 03:49  render(onboarding): L5 morning setup reorder, picker between bubbles
2026-07-09 03:47  render(onboarding): L3 29 per-goal habit-pick opener beats
```

### `all-flows-one-source-render`
```
2026-07-09 00:27  render: add flow layer and header play controls
2026-07-08 23:25  render: add beat rules guard
2026-07-08 22:31  render: add remaining flows to one-source beats
2026-07-08 19:06  render one-source: rebind context from Beats Context tab + script[] as playback driver
2026-07-08 10:57  Show beat id before screen id in render rail
```

### `annotate/sample-category-women`
```
2026-07-09 16:31  render: fold beat metadata into the single Bible card
2026-07-09 16:04  render: fill category-women to the full 12-section Bible + accordion UI
2026-07-09 13:44  render: move play control + engine chip out of the phone into the beat header
2026-07-09 13:22  render: collapse variant beats in #play + gate grid reveal + fix profile split
2026-07-09 12:57  render: add variation switcher to concept groups (annotated view)
```

---

## Conflict & Confusion Flags

### 🚨 FLAG 1: Render Target Moving (!532, !531)
- **!532** targets `structure/global-layer → annotate/sample-category-women`
- **!531** targets `annotate/bible-fill-all → annotate/sample-category-women`
- **Problem:** `annotate/sample-category-women` is itself a live, actively-committed branch (5 commits in 24h, newest 16:31). Both MRs are trying to land on a moving target. Both are draft. Likely conflicts and/or need reconciliation after the target branch lands to main.

### 🚨 FLAG 2: One-Source Render Chain Complexity (!515, !527)
- **!515** "Render all flows one-source rules" targets `flow-annotated-render`
- **!527** "110 habit-ack clips" targets `all-flows-one-source-render` (a SIBLING of flow-annotated-render, not derived from it)
- **Problem:** `all-flows-one-source-render` exists as a parallel build. Unclear merge strategy: does !515 land to flow-annotated-render first, then flow-annotated-render → all-flows-one-source-render? Or is all-flows-one-source-render a peer that needs separate rules? The commit history shows they diverged ~2026-07-08 08:00.

### 🚨 FLAG 3: Azure Provider to `production` Branch (!530)
- **!530** `chore/azure-provider-to-production → production` is DRAFT and targets the `production` branch
- **Parallel:** **!529** "Azure LLM_PROVIDER flag" MERGED to main (2026-07-09 15:47)
- **Problem:** Two different Azure commits with different targets. !529 is gated-flag on main (inert by default). !530 targets `production` which is not part of the normal flow. Likely duplicate/superseded or a cost-migration staging step. UNCLEAR PURPOSE.

### ⚠️ FLAG 4: Render Parity & Source Integrity Gates (!509, !514, !521)
- **!509** "Add render parity export" → main (draft, 2026-07-09 00:57)
- **!514** "source_integrity guard + required CI job" → flow-annotated-render (draft)
- **!521** "wire render guards into CI (report mode)" → flow-annotated-render (draft)
- **Problem:** Three CI/parity-gating MRs at different stages (parity to main, guards to render branch, wire to render branch). Unclear sequence: does !509 land first? Are !514 and !521 dependent on it? The parity gate is in HANDOFF-render-parity-gate.md as "report mode", not required yet.

### ⚠️ FLAG 5: Reconciliation Blocked (!507 on main)
- **!507** "fix/onboarding-render-reconcile" → main is DRAFT (2026-07-07 20:49)
- **Status per handoff:** "green, gates Lane B"
- **Problem:** This blocks the full onboarding parity / flow-reconcile. Multiple render MRs (!523, !525, !527, etc.) are stacked above it awaiting this to land. Likely a critical blocker if any of them need coordination.

### ⚠️ FLAG 6: Behavior Rules !526 Ready to Merge (Not Draft)
- **!526** "onboarding behavior rules enforcement" → main is **NOT draft** (state=opened, draft=false)
- **Status:** Rules 1,2,4/5,6,7 green; rule 3 deferred to flow-reconcile (!507)
- **Issue:** Only non-draft ready-to-merge MR targeting main in the critical path. Unclear if it should be merged now or gated by !507. No blocker notation on the MR itself.

---

## Totals & Distribution

| Category | Count | Notes |
|----------|-------|-------|
| **Total open MRs** | 47 | Stable since yesterday. |
| **Draft MRs** | 24 | Most onboarding/render chain. |
| **Ready to merge** | 23 | Mostly cleanup, voice fixes (already merged). |
| **Targeting main** | ~20 | Behavior rules (!526), voice/LLM fixes, cleanup, parity (!509), reconcile (!507). |
| **Targeting flow-annotated-render** | ~15 | Render variants, audio, CI guards, exemplar beats, play controls, voice timing. |
| **Targeting all-flows-one-source-render** | ~3 | Habit-ack audio, onboarding-mp3-voice. |
| **Targeting other branches** | ~9 | Azure (production), structure (sample-category-women), exemplar (flow-annotated-render). |
| **Azure/Provider-related** | 2 | !529 (merged, flag-gated), !530 (draft, to production). |
| **CI/QA-related** | 4 | !521, !514, !519 (stub TTS), !509 (parity). |
| **Merged in 48h** | 15 | Clean audio/voice fixes, Azure flag, cleanup. |

---

## Assessment

**Hot zones (active, high churn):**
- Render variant/structure consolidation (!532, !531, !523)
- One-source rules & audio chain (!515, !527)
- Render parity & CI gates (!509, !514, !521)
- Onboarding reconciliation (!507, !526)

**Healthy merges (48h):**
- Azure provider flag (!529) — inert, cost-migration ready
- Voice/audio fixes — all via main, 9 merged
- One-source copy logic (!517) — finisher to flow-annotated-render

**Open questions:**
1. Is !532 stale (moving target) or waiting for annotate/sample-category-women to land to main?
2. Does all-flows-one-source-render need its own rules (!515) or does it consume from flow-annotated-render?
3. Is !530 (Azure to production) a real code path or orphaned cost-migration staging?
4. Should !526 (behavior rules, ready to merge) wait for !507 (reconcile) or merge now?
5. What's the sequence for parity (!509) → CI gates (!514, !521)?
