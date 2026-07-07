# Regression register — Guided Growth onboarding

> **The point of this file:** we have spent months in the "fix one thing, break
> another" loop. This is the ONE place every regression is recorded AS a
> regression, in context: what worked before, what broke, WHICH change broke it,
> how we caught it, and the fix that closes it. A regression is never fixed "out
> of the blue" here; its fix always links back to the change that caused it.

## Standing rule (2026-07-07, Yair)

Every acceptance verdict and every round judge MUST name regressions explicitly.
Not "found a bug", but: this behavior worked on build X, broke on build Y, the
change that introduced it was Z. Log it here the moment it is found. When the fix
lands, fill in the Fix + Status columns. No regression stays only in ledger prose
or an MR note; it also lands as a row here.

Definitions:
- **Regression** = something that DEMONSTRABLY worked on a prior build and broke on
  a later one. Distinct from a genuinely-new defect (never worked) and from a
  known-open bug still being fixed.
- **Introduced by** = the MR / commit whose change caused the break. If unknown,
  write "unbisected" and it is a priority to find, because an unattributed
  regression is how the loop repeats.

## Register (newest first)

| Found | Regressed behavior (worked before -> broke now) | Introduced by | Detected by | Fix | Status |
|---|---|---|---|---|---|
| 2026-07-07 | ONBOARD-BEGINNER-04 two-part opener: part 2 stopped playing (only part 1 fired) | !498 (B58 beat-audio double-arm fix) | !498 live acceptance + B04 probe (notes 4020/4046) | folded into the B40 audio wave: !505 makes the multi-part handoff deterministic (single-playback enforcement, pause the live blob on cross-beat handoff) | in-progress (later found INTERMITTENT, a race; !498 stays merged as a net improvement 43->6 backoffs; B40 wave owns making part-2 deterministic, multi-run acceptance) |
| 2026-07-07 | Beat-audio backoff churn got WORSE between rounds (max ~75 vs ~55 prior) | audio change in the B58/B40 line between round 2 and round 3 (unbisected at the time) | round-3 judge (gg-spec docs/qa-rounds/round3-judge-2026-07-07.md) | !498 landed the double-arm churn fix (34->5/walk); !505 closes the remaining fork Cartesia-vs-WAV overlap | in-progress (!498 merged; !505 fork-overlap fixer in flight) |

## How to add a row

1. When an acceptance walk or a round judge finds that a previously-passing
   behavior broke, add a row here BEFORE (or with) filing the fix.
2. Fill "Introduced by" even if it takes a `git bisect` / a diff read across the
   two builds. An unattributed regression is the dangerous kind.
3. When the fix merges, update Fix + Status. "holding" = confirmed still fixed in a
   later round; "fixed" = fix merged, not yet re-confirmed in a subsequent round.
4. Keep the "worked before -> broke now" phrasing. That framing is the whole value.
