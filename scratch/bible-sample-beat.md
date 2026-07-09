# Bible sample fill: ONE beat, all 12 sections

Sample for shape sign-off before the annotation-scale fill. Beat chosen: **`category-women`**
(order 12, the women's-art variant of the focus-area selection). It is a category-selection
beat and the single richest one: everything the plain `category` beat has (verbatim opener,
selectable tiles, `submit_category`, advance-on-tool, create-your-own branch, six coach-behavior
rules) PLUS it binds decision 3, so `applicable-decisions` and `rules.code` both fill with a real
gender-variant contract instead of "none". Grounded in `beatsSource.ts` (order 12) and
`coach-per-beat-2026-07-09.md` (archetype C-adjacent). No em dashes. Straight quotes.

Legend: lines that depend on final copy are tagged `[COPY-PENDING: Yair's final copy this hour]`.
Every rule in sections 5 and 6 names a real enforcer. Nothing is prose-only.

---

## 1. identity

| field | value |
|---|---|
| beatId (canonical) | `category-women` |
| name | Category (women's art) |
| order | 12 |
| path | `beginner` |
| type | `category-grid` |

Alias contract (one source generates all maps; unmapped beat is rejected):

| alias surface | value |
|---|---|
| `screenId` | `ONBOARD-BEGINNER-01` |
| route | `/onboarding/beginner-01` (women-art variant) |
| persisted `current_step` | `category-women` |
| `session_log` value | `category-women` |
| `data-beat-id` | `category-women` |

Watch-out: `category` and `category-women` SHARE `screenId` `ONBOARD-BEGINNER-01`. The beatId is
the only unique key, so the render selects the variant by gender (section 6 code rule), not by
screenId. The alias-check must allow two beatIds on one screenId while keeping each beatId's other
aliases unique.

**Enforcer:** `id-alias-check` (static).

---

## 2. script

Ordered lines exactly as source, PLUS the two missing per-line fields the Bible requires
(`reveal`, `timing`). Reveal gates on the PRIOR line's clip end, never a fixed timer.

| seq | words | bindsTo | voice | clip | reveal | timing |
|---|---|---|---|---|---|---|
| 1 | "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories." `[COPY-PENDING]` | bubble `bubble-1` | mp3 | `onboard_beginner_01_1` | opener bubble; no gate | karaoke per-word on the bubble |
| 2 | (no spoken line) | component `reveal-8` | mp3 | null | the category tiles bloom, GATED on seq 1 clip end | n/a (silent reveal) |
| 3 | "Or you can create your own." `[COPY-PENDING]` | component `reveal-9` | mp3 | `create_your_own` | the create-your-own tile blooms, GATED on seq 2 reveal + this clip is VERBAL ONLY (not a bubble) | karaoke per-word, no bubble |

**Enforcers:** `render-link-integrity-check` (clips + bindings resolve) + `reveal-timing-check`
(reveal-8 / reveal-9 gate on clip end, not a timer).

---

## 3. components

What actually renders on the clean mirror phone (no chrome).

| field | value |
|---|---|
| component (registry key) | `category-grid` |
| variant | `female` (from source `props.variant: 'female'`) |
| on-screen tiles | 8 category tiles: Sleep better, Move more, Eat better, Feel more energized, Reduce stress, Improve focus, Break bad habits, Get more organized `[COPY-PENDING: confirm label set + order]`, plus a "Create your own" tile |
| selection mode | single-select, no preselection |
| exact state | nothing selected on entry; tiles render with the women's-art illustration set; create-your-own tile appears last (reveal-9) |
| derived (debug, generated never authored) | resolved props: `{ variant: 'female', tileCount: 8, allowsCustom: true }` |

Watch-out: the ONLY structural difference from `category` is `variant: female`. The tile labels,
count, and single-select behavior are identical.

**Enforcer:** `component-registry-check` (static).

---

## 4. voice

| field | value |
|---|---|
| engine | MP3 |
| mode | Verbatim (reconciled from source `Verbatim`; enum is Verbatim / Generative) |

Per-line live-vs-clip:

| seq | resolves to | live allowed? |
|---|---|---|
| 1 | recorded clip `onboard_beginner_01_1` | NO |
| 2 | silent reveal (no audio) | n/a |
| 3 | recorded clip `create_your_own` | NO |

Audio-ownership assertion: no line here carries a live slot like `{name}`, so EVERY spoken line
MUST resolve to a recorded clip id. None may resolve to live Cartesia.

**Enforcer:** `audio-ownership-check` (static).

---

## 5. rules.context (coach behavior)

Lifted out of the source `context` prose into discrete enforced rules. `enforcedBy` is never null.

| id | rule | severity | enforcedBy |
|---|---|---|---|
| catw-verbatim-opener | Speaks the recorded opener and the create-your-own line verbatim, no improvised lead-in | must | `eval:verbatim-opener` |
| catw-no-read-options | Never reads the category tiles aloud, not in full, not one as an example | must | `eval:no-read-options` |
| catw-no-praise-pick | No praise after the pick ("great choice", "love that") | must | `eval:no-praise-pick` |
| catw-no-contrarian | No reframe that undercuts the pick ("sleep isn't really the issue") | must | `eval:no-contrarian-turn` |
| catw-no-platitudes | No per-category commentary or filler ("sleep is the foundation", "genuinely") | must | `eval:no-platitudes` |
| catw-one-line-wait | After the opener, asks one short pointer question then waits | must | `eval:one-line-then-wait` |
| catw-single-select | Allows exactly one category; on two, asks which feels most urgent | must | `eval:single-select` |
| catw-stay-open | If the user is unsure, stays open and helps them land on one, no lecture | should | `eval:stay-open-unsure` |

---

## 6. rules.code (engine invariants)

Each names a real static enforcer.

| id | rule | severity | enforcedBy |
|---|---|---|---|
| catw-tools-only | Only `submit_category` and `advance_step` are callable on this beat | must | `tool-contract-check` |
| catw-advance-on-tool | `advance_step` fires only after `submit_category` captured a valid category | must | `advance-gate-check` |
| catw-women-variant | This variant renders ONLY when gender == woman; men, non-binary, undisclosed get the default `category` render | must | `component-registry-check` |
| catw-reveal-gates | reveal-8 and reveal-9 gate on the prior line's clip end, never a fixed timer | must | `reveal-timing-check` |
| catw-audio-ownership | Every spoken line resolves to a recorded clip; no live Cartesia (no `{name}` slot) | must | `audio-ownership-check` |
| catw-clips-resolve | `onboard_beginner_01_1` and `create_your_own` resolve to real assets | must | `render-link-integrity-check` |
| catw-id-alias | beatId maps to the screenId / route / step / session_log / data-beat-id in section 1 | must | `id-alias-check` |

---

## 7. context (coach prose)

The coach's readable brief for framing and tone. The SPEAK MODE and DO NOT behavior lines have
moved OUT into section 5; what remains is the framing prose. `[COPY-PENDING: Yair's final copy
this hour]` on the wording below (current source text):

> Focus area. Collect one category. The opener shows as a coach bubble, then the category tiles
> appear (women's-art illustration set). When the create-your-own option appears at the end, "Or
> you can create your own" is spoken verbal only. Ask what they most want to work on, then wait. If
> they are unsure, you can talk it through with them and help them land on one. If they name
> several, ask which feels most urgent. Keep the response specific to their pick.

**Enforcer:** parity-walk QA-eval (`eval:parity-walk`).

---

## 8. allowedTools

Tool list, call-rules, and per-tool arg schema.

Tools: `submit_category`, `advance_step`.

Call-rules (inherited from GLOBAL_CONTEXT, bound here): call once the category is captured; only
this beat's tools; pass the canonical category value, not the user's raw words.

| tool | arg schema | when |
|---|---|---|
| `submit_category` | `{ category: string }` where category is one of the 8 canonical labels OR a custom string from the create-your-own tile `[COPY-PENDING: confirm canonical enum]` | once the user has settled on exactly one category |
| `advance_step` | `{}` | immediately after `submit_category` returns |

Note: there is NO `submit_habits` or `submit_goals` on this beat. Category uses `submit_category`
only (per coach-per-beat tool correction).

**Enforcer:** `tool-contract-check` (static).

---

## 9. persistence

| field | value |
|---|---|
| writes | the chosen category (one value) + the gender-derived variant flag |
| never re-ask | the category, once captured, is carried forward; downstream goal/habit beats read it, never re-prompt |
| resume key | `current_step` advanced past `category-women` proves this beat is done on refresh |

Watch-out: exact table + column for the category write is NOT in the render source or the docs I
read. Flagged for app-reconcile; do not invent a table name. The carry-forward contract (never
re-ask category) is from GLOBAL_CONTEXT and is real.

**Enforcer:** `persistence-contract-check` (static).

---

## 10. flow (advance + branch)

| field | value |
|---|---|
| advance condition | `submit_category` fired with a valid single category, then `advance_step` |
| upstream branch (into this beat) | gender == woman selects this women-art variant; all other genders route to the default `category` beat |
| downstream branch (out of this beat) | create-your-own tile -> `goal-custom` (order 21); any of the 8 canonical categories -> the matching `goals-*` beat by category (e.g. Sleep better -> `goals-sleep`, order 13) |
| gate | exactly one category; if the user names two, the coach resolves to one before the tool fires (section 5 catw-single-select) |

**Enforcer:** `advance-gate-check` (static).

---

## 11. edges

Per-beat edge handling (not just GLOBAL_CONTEXT generic).

| edge | behavior |
|---|---|
| tool failure | `submit_category` errors: stay on the beat, do not narrate the failure, let the user pick again |
| off-topic input | acknowledge briefly, steer back with one short pointer question, do not advance |
| skip / decline | user will not choose: stay open, help them think it through (catw-stay-open), never force |
| empty state | no tiles appeared for the user: ask one neutral question ("Is anything coming up for you to pick from?"), do NOT recite the category list to fill the silence |
| names two | ask which feels most urgent, then take the one |
| names something off-list | route to the create-your-own tile / custom category |

**Enforcer:** `eval:edge-walk` (QA-eval, fleet).

---

## 12. acceptance (definition of done)

| criterion | check |
|---|---|
| shows the right thing | phone renders `category-grid` variant `female`, 8 tiles + create-your-own, single-select, nothing preselected (diff phone vs section 3) | 
| says the right thing | opener spoken verbatim, create-your-own verbal-only, no read / praise / contrarian / platitude (section 5 evals) |
| advances correctly | exactly one category captured via `submit_category`, then `advance_step`; two-category attempt resolves to one first (section 10 gate) |
| survives a refresh | category persists, beat not re-asked, `current_step` resumes past `category-women` (section 9 resume key) |
| variant is correct | gender == woman renders this beat; any other gender renders default `category` (section 6 catw-women-variant) |

**Enforcer:** composite. Static: `component-registry-check`, `advance-gate-check`,
`persistence-contract-check`, `render-link-integrity-check`. QA-eval: `eval:parity-walk` +
`eval:edge-walk` on a live fleet walk.

---

## applicable-decisions

| decision | binds here? | how |
|---|---|---|
| 3. Women's art variant (gender == woman is the ONLY selector; men / non-binary / undisclosed get default) | YES | this beat IS the render side of decision 3; encoded as `rules.code` catw-women-variant with `component-registry-check` |
| 1, 2 (profile gates), 4/5 (habit caps), 6, 7 (reflection) | none | not this beat |

Marked explicitly so coverage is provable, never null.

---

## Build watch-outs

1. **Shared screenId across two beats.** `category` and `category-women` both use
   `ONBOARD-BEGINNER-01`. The beatId is the only unique key and the gender-variant code rule is
   what disambiguates them. `id-alias-check` must permit two beatIds on one screenId while keeping
   the rest of each beat's aliases unique. This is exactly the kind of drift the Bible's identity
   section flags, surfaced live here.

2. **Persistence table + column unknown.** The render source and the docs I read do not name the
   table/column the category write lands in. I left persistence conceptual and flagged it for
   app-reconcile rather than inventing a schema. The full-build packet needs the real
   `screen_contexts` / profile / onboarding write target confirmed.

3. **`submit_category` arg enum not locked in source.** The 8 canonical category labels are inferred
   from the `goals-*` beat `props.category` values (Sleep better, Move more, etc.); the exact
   enum + the custom-category shape for create-your-own is `[COPY-PENDING]`. The arg schema in
   section 8 is grounded but the enum needs confirming against `beat_contexts.json`.

4. **`eval:parity-walk` and `eval:edge-walk` are named but not in the delivered 9.** Sections 7, 11,
   12 reference these two QA-evals (they appear in the Bible spec table as the context / edges /
   acceptance enforcers) but they are NOT in the 9 coach-behavior evals I was given. Confirm the
   fleet has these two registered, or they fail the `check:rules` resolvability guard.

5. **Upstream gender routing owner.** catw-women-variant says gender == woman selects this variant,
   but WHO makes that selection (the engine at beat-entry vs a render-time prop) is not spelled out
   in the source. I wrote it as a render-variant selector per the Bible; the full build must name
   the code path that reads gender and picks the beatId.

6. **`create_your_own` clip is shared across category variants.** Both `category` and
   `category-women` bind the same `create_your_own` clip on reveal-9. Fine for audio, but the
   link-integrity and audio-ownership checks should treat one clip bound from two beats as valid,
   not a duplicate error.
