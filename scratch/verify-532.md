# Verify !532 (structure/global-layer -> annotate/sample-category-women)

Read-only check, 2026-07-09. Project: guidedgrowth-group/guided-growth-mvp (self-hosted GitLab).

## 1. Merge status

- `merge_status`: `can_be_merged`
- `detailed_merge_status`: `draft_status` (only thing blocking a real merge is the Draft flag; GitLab sees no git conflict against the CURRENT target branch head)
- `has_conflicts`: `false`
- Cleanly mergeable into `annotate/sample-category-women` **as it stands right now** (i.e. before !531 lands). This does NOT tell us anything about ordering against !531 — GitLab only diffs against the live target branch, not against a hypothetical post-other-MR state. See section 3.

## 2. Draft / SHA / freshness

- `draft`: `true`, `work_in_progress`: `true` — title is "Draft: Draft: render structure: GLOBAL layer + section 13 + variantOf inheritance + io contracts + files/sync map"
- Source branch: `structure/global-layer`, head SHA: `7498b7a4350ad580c8ba1872742e90bc059fc94f` (short `7498b7a4`)
- `updated_at`: 2026-07-09T18:24:01.990Z (created same instant, no revisions since)
- Author: Mintesnot M. (jamymarcoss47)
- Changed files (3): `FlowDesigner.tsx`, `beatsSource.ts`, `flowBible.ts` (new file)

## 3. Overlap with !531 (beat 13, goals-sleep, source annotate/bible-fill-all)

Both MRs branch from the **same base commit** (`6c9232b1d285786276ed220bcc9a33dfd6d1d6a6`) into the same target (`annotate/sample-category-women`). GitLab's own diffs API returned empty/collapsed diffs for `beatsSource.ts` on both MRs (silently truncated — file is large), so I pulled the raw file content at each MR's base/head SHA directly from the repo and diffed locally.

**Only `beatsSource.ts` overlaps.** (`flowBible.ts` is new in !532 only; `FlowDesigner.tsx` is !532-only.)

- !531 touches base lines: ~1041-1042, ~1140, and inserts ~340 new lines after ~1208 (the goals-sleep bible fill).
- !532 touches base lines throughout the file (123 hunks) as part of a schema-wide unification, including base lines ~1041-1042, ~1137-1149, and insertions immediately around ~1189 and ~1224 (bracketing !531's insertion point at ~1208).

Two of the three overlapping base-line ranges resolve to **identical resulting text** on both sides (a string-formatting fix at 1041-1042, and a quote-escaping fix at 1140) — those alone would not conflict since both branches produce the same output.

The real conflict is at **base lines 1137-1149**: this is the `applicableDecisions` field of the goals-sleep beat entry (order 13) — the exact beat !531 is filling in.
- !531 leaves it as an array, just fixing a quote-escape inside it.
- !532 restructures it (schema unification) from a bare array into `{ rows: [...], enforcedBy: [...] }`, as part of its global "enforcedBy arrays everywhere" change.
- !531 then inserts ~340 lines of full bible content (using the OLD array-shaped `applicableDecisions` and other pre-unification conventions) directly after this same beat, at line ~1208.

Merging !532 first rewrites the schema shape at exactly the site !531 is about to insert into, using the pre-unification schema. Git's line-based conflict detection will very likely flag this as a conflict on `beatsSource.ts` when !531 (or a rebase of it) is merged afterward, and even if it doesn't hard-conflict, !531's new content would be silently non-conformant with the new schema (old-style `applicableDecisions` array sitting next to new-style `enforcedBy` arrays everywhere else). The !532 MR description itself flags this: *"Sequencing note: stacks on annotate/sample-category-women; coordinate with the parallel bible-fill work before merging."*

**Conclusion:** merging !532 first will very likely require !531 to be rebased/reworked (either resolve a git conflict, or otherwise migrate its beat-13 content to the new schema shape) before !531 can land cleanly.

## 4. Coverage of the 3 just-locked decisions (checked against `flowBible.ts` content directly, not just the MR description)

- **(a) Improvise windows off/minimal for onboarding** — PRESENT but explicitly marked **not final**. `IMPROVISATION.law`: *"Window boundaries PENDING a dedicated Yair discussion (2026-07-09 ruling); the windows below are deliberately MINIMAL, especially on MP3 beats, and are not final."* `default: 'OFF'`. So the shape is built per the ruling (off by default, minimal named windows), but the file itself says the boundaries are still open, not locked.
- **(b) Multi-turn as its own section 13** — PRESENT and **locked**. `CONVERSATION_MODEL.placement`: *"DECIDED (Yair 2026-07-09): multi-turn is its own SECTION 13 per beat."* Also appears in `OPEN_DECISIONS` with a filled `decided:` field (fully closed out in-doc).
- **(c) Tool-failure contract (retry then surface)** — content is PRESENT and matches the described shape (`TOOL_FAILURE`: one silent retry -> voice gets one short coach line + retry + tap-path offer on 3rd failure; text/tap gets a toast; beat never advances on a failed write). BUT the doc marks it `status: 'needs-yair'`, and in `OPEN_DECISIONS` the `tool-failure-copy` entry has a `question` + `proposal` but **no `decided:` field** (unlike (a) partially and (b) fully) — i.e. the MR itself still lists this as open/awaiting Yair's sign-off, not yet closed out like (b).

Net: (b) is fully locked-in per the doc's own decision log; (a) and (c) are built to spec but the document is self-reporting them as still pending Yair confirmation, not yet closed.

---

## Answer

**NO-GO on merging !532 as the structure base right now** — not because of any git-detectable conflict today, but because it edits the exact same `applicableDecisions` block (base lines ~1137-1149) of the goals-sleep beat that !531 is filling in with the old schema shape immediately below it (line ~1208); merging !532 first will conflict with or silently break !531's content on landing, and the MR author flagged this exact sequencing risk themselves.

**Head SHA:** `7498b7a4`

**!531 overlap/order:** Real overlap confined to `beatsSource.ts`, centered on the goals-sleep beat's `applicableDecisions` block and its adjacent insertion point — land !531 (the narrower, single-beat MR) first, then rebase !532 on top so the schema unification sees and can migrate !531's new content.
