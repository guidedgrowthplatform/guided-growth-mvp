# Global Layer Comparison — Old Rich View vs. New Fold

## Direct answer

Yair is seeing a **representation change, not merely a styling change**. The old `FlowDesigner` rendered the rich `flowBible.ts` global layer as topic sections: behavior, runtime contracts, consumers, enforcement evidence, canonical data, decisions, and operational inventory. The new fold renders only the proposed **runtime-policy subset**: 26 rules, eight reactive slots, and five contract summaries.

`GLOBAL-RULES-FULL.md` deliberately treats much of the old material as **adjacent evidence**, not runtime policy. That is defensible for a policy implementation source, but it is not equivalent to the old review display. The deployed fold therefore makes real material disappear from the reviewer’s view.

## 1. Why the new view differs

### Per-section disposition

| Old rich section | What the proposal did | Where it went in the new proposal | Shown in current fold? |
| --- | --- | --- | --- |
| 1. **Improvisation Law** | Kept, amended for the one approved runtime-name/Cartesia exception. | Inventory 1 → `GR-02` plus `VOICE_OWNERSHIP`. | **Yes, compressed.** `GR-02` is visible; the ownership detail is only a contract summary. |
| 2. **Global Rules (15)** | Kept, split, expanded, and one rule retired. | Inventory 2–17 → `GR-01`, `GR-03`, `GR-06`–`GR-10`, `GR-13`–`GR-18`, and `GR-22`; old acknowledgment rule (`glob-ack-where-declared`) is intentionally retired under `GR-10`. | **Yes.** Rules are visible, but flattened into one 26-item list rather than topic groups. |
| 3. **Tool Failure Contract (VERIFIED)** | Kept and amended. | Inventory 18 → `TOOL_FAILURE`, `GR-12`, `GR-26`, and reactive slot `onboard_toolfail_voice`. | **Yes, partially.** The rule, slot, and one-line contract responsibility show; the old retry/voice/text/never fields do not. |
| 4. **Multi-Turn Model (global defaults)** | Kept and amended. | Inventory 19 → `CONVERSATION_MODEL`, `GR-02`, `GR-20`, and `GR-25`. | **Only as a summary.** The `CONVERSATION_MODEL` title/responsibility appears; the old placement, loop, `maxTurns`, and `onMaxTurns` fields do not. |
| 5. **Data Passing Contract (VERIFIED)** | Kept. | Inventory 37 → `DATA_PASSING`, `GR-07`, `GR-22`, and `GR-26`. | **Only as a summary.** The contract label appears; transport, forbidden values, cold-resume, and reference details do not. |
| 6. **Coach = the LLM** | Kept, renamed and narrowed to tool/advance ownership. | Inventory 38 → `COACH_TOOL_BOUNDARY`, `GR-21`, and `GR-26` under Contract B. | **Only as a summary.** The former identity, governed-by, backend-boundary, and path rows are not shown. |
| 7. **Consumer Contract (6)** | Retained as an adjacent consumer/completeness audit, not runtime policy. | Inventory 39–44 → adjacent ledger, explicitly not duplicated as rules. | **No.** No phone-preview, playback, engine, context-assembly, guard, or QA-fleet consumer view exists in the fold. |
| 8. **Enforcer Registry (33)** | Retained as adjacent audit/catalog evidence; statuses are revised against `ENFORCEMENT-AUDIT.md`. | Inventory 66–98 → adjacent enforcer catalog. Individual IDs are attached to proposed rules. | **No registry view.** The fold shows rule-level enforcer chips only, not the 33-row registry, definitions, or status audit. |
| 9. **Canonical Enums** | Retained as adjacent canonical-data evidence. Gender routing semantics also inform rules. | Inventory 102–103 → adjacent enum material; gender is reflected in `GR-18`/`GR-22`. | **No.** There is no canonical gender/category enumeration display. |
| 10. **Open Decisions (8 in the review view)** | Excluded from the 132-entry policy inventory as governance material; selected locked decisions are applied in the proposal. | Superseding-decisions and contradiction sections; some outcomes are embodied in rules such as `GR-02`, `GR-05`, `GR-18`, `GR-22`–`GR-24`. | **No decision-library view.** A reviewer cannot see the decisions, owner/ruling, or unresolved/retired context from the fold. |
| 11. **Files + Save + Sync Map (132)** | Explicitly excluded as operational inventory, not global behavior/contracts. | It remains an adjacent operational artifact in the old source; it is not part of the proposal’s 132-entry inventory. | **No.** No files, saves, sync edges, or stale-risk map appears. |

Two things make the gap feel larger than the counts imply:

1. The old view made each concern independently inspectable. The new UI has one top-level header and three flat buckets: **Behavioral rules**, **Locked reactive slots**, and **Amended contracts**.
2. The word **“132” now means two different things**. In `flowBible.ts`, the Files + Save + Sync Map contains 132 operational rows. In `GLOBAL-RULES-FULL.md`, the 132-entry inventory is a different, selected set of old-source policy/contracts/audit rows. The proposal explicitly excludes the 132 file-map rows, `OPEN_DECISIONS`, and `OPEN_ITEMS`.

## 2. Was it reconciled?

### Honest finding: reconciled as a selected migration inventory; not reconciled as a complete review display

The proposal’s checker claim is credible **within its stated scope**: it says all 132 selected entries are source-matched and traced exactly once to Runtime, Adjacent, or Removed. The source-to-destination table is explicit, and the ten spot checks below agree with it.

That is **not** the same as “everything in the old global layer is now represented in the displayed fold.” The proposal itself excludes the old file/sync map and decision library from its 132 count, and it classifies consumer, completeness, enforcer, and enum material as adjacent rather than visible runtime policy. The current fold then omits those adjacent views entirely.

### Ten spot checks across the old sections

| Old material checked | Proposal trace | Result |
| --- | --- | --- |
| Improvisation OFF / no windows | Inventory 1 → `GR-02` and `VOICE_OWNERSHIP`. | **Accounted for**, with the proposed single Cartesia/name exception. |
| Empty-state global rule | Inventory 13 → `GR-14` and `onboard_empty`. | **Accounted for**; both policy and locked slot are displayed. |
| Tool-failure retry/surface contract | Inventory 18 → `TOOL_FAILURE`, `GR-12`, `GR-26`, and tool-failure slot. | **Accounted for**, but the fold loses the old field-by-field contract explanation. |
| Global multi-turn defaults | Inventory 19 → `CONVERSATION_MODEL`, `GR-02`, `GR-20`, `GR-25`. | **Accounted for in the document**, but not actually shown as a multi-turn model in the fold. |
| Canonical carry-forward/data passing | Inventory 37 → `DATA_PASSING`, `GR-07`, `GR-22`, `GR-26`. | **Accounted for**, but only the contract name/responsibility is displayed. |
| Coach identity and backend/tool boundary | Inventory 38 → `COACH_TOOL_BOUNDARY`, `GR-21`, `GR-26`. | **Accounted for as an amendment**, but the old coach section’s detail is absent from the fold. |
| Consumer: phone-preview responsibility | Inventory 39 → adjacent consumer/completeness ledger. | **Preserved as reference**, **not displayed**. |
| Enforcer: `eval:invalid-value-redirect` | Inventory 94 → adjacent enforcer catalog; it is referenced by `GR-06`. | **Preserved/referenced**, but no registry row is displayed; a chip does not replace the registry. |
| Canonical gender/category enums | Inventory 102–103 → adjacent enum material; gender routing is reflected in `GR-18`/`GR-22`. | **Preserved/referenced**, but no enums view is displayed; category enum visibility is fully lost. |
| `FILES_SYNC_MAP` operational rows | Explicitly excluded by the proposal’s scope/counting section. | **Not accounted for by the proposal’s 132 inventory and not displayed.** This is intentional scope exclusion, not a successful migration of that section. |

### What was lost between proposal and displayed fold

The fold has not necessarily lost the *policy text* for every runtime concern, but it has lost these review surfaces:

- **Multi-turn model:** reduced to a one-line contract responsibility; no global-default fields.
- **Data passing and coach identity:** reduced to one-line contract responsibilities; no detailed rows.
- **Consumer contract:** absent.
- **Enforcer registry:** absent as a registry; only per-rule chips remain.
- **Canonical enums:** absent as a canonical-data view.
- **Decision library:** absent.
- **Files + save + sync map:** absent, and outside the proposal’s 132 inventory.
- **Completeness, migration, and provenance evidence:** absent or only indirectly mentioned.

So the precise answer is: **the document did a disciplined, two-way trace for its selected 132 entries, but the new display did not carry the document’s “Adjacent” material forward. It is not a reconciled replacement for the old rich global-layer review.**

## 3. Should the new set be by category?

### Recommendation: yes — default to Yair’s “by topic” preference

Keep the proposed rule IDs, slots, and contract IDs, but render them in topic sections. This preserves policy normalization while restoring reviewability. A flat list is useful for an export/checker; it is poor for a human comparing scope, contracts, evidence, and decisions.

| Proposed display section | Contents to place there | Rationale |
| --- | --- | --- |
| **1. Authority, precedence, and safety** | Provenance/activation warning; `GR-01`; `GR-03`; conflict semantics. | Establishes which rule wins and makes the safety boundary reviewable before normal onboarding behavior. |
| **2. Coach output and conversation model** | `GR-02`, `GR-04`, `GR-08`, `GR-20`, `GR-25`; `CONVERSATION_MODEL`; `VOICE_OWNERSHIP`; old Improvisation Law fields and old Multi-Turn fields. | These jointly answer what the coach may say, when it may say it, and who/what owns output. |
| **3. Current-beat input and picker behavior** | `GR-06`, `GR-09`, `GR-10`, `GR-13`–`GR-18`, `GR-19`, `GR-22`, `GR-23`; the eight slot rows grouped by trigger. | Puts invalid input, empty state, over-selection, custom entry, nudge, and gender follow-up beside their exact locked responses. |
| **4. Progress, state, and completion** | `GR-05`, `GR-07`, `GR-21`, `GR-24`, `GR-26`; `DATA_PASSING`; `COACH_TOOL_BOUNDARY`; old data-passing and coach-boundary fields. | Makes no-skip, carry-forward, persistence, advance ownership, and destination auditable together. |
| **5. Tool failure** | `GR-12`; `TOOL_FAILURE`; `onboard_toolfail_voice`; old retry/voice/text-or-tap/never rows. | Tool failure is operationally distinct and should not be buried among generic reactive rules. |
| **6. Consumer contract** | The six old consumer rows, marked “adjacent implementation contract.” | The renderer, playback, engine, LLM context, guards, and QA fleet need an explicit reader contract even if they are not runtime policy. |
| **7. Enforcement registry** | All 33 registry rows, retired mappings, definition/status, plus rule-to-enforcer links. | Rule chips are useful navigation, but they cannot show whether an evaluator exists, what it checks, or its honest status. |
| **8. Canonical enums and data contracts** | Gender and category enums; resolved data contracts; references from `GR-07`, `GR-18`, `GR-22`, `GR-26`. | Makes canonical values and routing inspectable instead of hiding them in prose. |
| **9. Decisions and unresolved governance** | Old decision library/open items, including the decisions the proposal applied and any remaining activation blockers. | Reviewers need to distinguish a locked product decision from a proposal choice or an implementation gap. |
| **10. Completeness, migration, and provenance** | Completeness contracts, app migration specs, activation gates, source/provenance evidence. | These are not behavioral rules, but they explain whether the policy can safely become real. |
| **11. Files, saves, and sync map** | The 132 `FILES_SYNC_MAP` rows, grouped by area and collapsed by default. | It is operational evidence, not policy; retaining it preserves the old source-of-truth navigation without inflating the rule set. |

This is slightly better than restoring the old headings literally: it keeps the old reviewer mental model, while placing the new policy additions (`GR-01`, safety, no-skip, caps, completion, Contract B) in the topics where they are actually evaluated.

### The only argument against topic grouping

A flat canonical array is easier to validate, export, and reference by ID. Keep that **data/checker form** flat. It does not follow that the reviewer UI should be flat: the UI can group the same stable IDs by category without changing policy order, ID uniqueness, or enforcement links.

## Verdict — concrete display-fold changes

A worker should make these display-only changes:

1. Replace the single flat “Behavioral rules” list with the first five topic groups above, preserving `GR-01`–`GR-26` IDs and their precedence metadata.
2. Render the eight slots under their triggering topic, and retain a compact “all eight slots” index for completeness; do not force reviewers to correlate `GR-11`–`GR-18` with a separate distant list.
3. Expand each of the five contracts from one-line responsibilities to its former key fields (especially tool failure, multi-turn defaults, data passing, and coach/tool boundary).
4. Restore collapsible **Consumer Contract**, **Enforcer Registry**, **Canonical Enums**, **Decision/Governance**, and **Files + Save + Sync Map** sections, clearly labeled “adjacent evidence / not runtime policy” where appropriate.
5. Show the proposal’s 132-entry traceability summary separately from the `FILES_SYNC_MAP` 132-row count, so the two inventories cannot be mistaken for one another.
6. Keep the existing proposed/activation-blocked warning prominent, and do not present rule chips or document traceability as proof of runtime enforcement.
