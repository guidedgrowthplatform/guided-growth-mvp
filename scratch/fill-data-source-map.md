# Bible fill: data-source map + gap audit (READ-ONLY)

Date: 2026-07-09. Question: for the onboarding beats, can a build session fill all 12
Bible sections from ACCESSIBLE source data, or would it hallucinate? Evidence below,
not reassurance.

Sources read: `beatsSource.ts` (branch annotate/sample-category-women, the ONE render
source, incl. the fully-filled `category-women.bible` template), the 6 gg-spec docs
(render-bible-spec, rules-enforceability-law, onboarding-behavior-decisions,
coach-per-beat-2026-07-09, onboarding-copy-flow-rules, weekly-projection-rules-APPROVED),
copy-drops.md, onboarding-habit-ack-2026-07-09.md, onboarding-system-audit.md, and the
generated `beat_contexts.json` + `screen_contexts.json`.

---

## CONFIDENCE VERDICT

**MOSTLY** (with the gaps flagged). 9 of the 12 sections + applicable-decisions are
SOURCED or reliably DERIVABLE for a typical beat. The invention-risk is concentrated
in three app-owned areas the template ALREADY models correctly (mark `pending:true` /
"flag for app-reconcile, do not invent"): per-tool arg schemas + the submit_category
enum, the persistence table/columns, and whether the named enforcers actually exist and
are fleet-runnable. A build can fill accurately IF it carries those forward as pending
flags rather than fabricating them. The one structural blocker: the per-habit-ack beat
has final copy but no beat entry yet, so its identity/flow/persistence cannot be filled
until the beat is created.

---

## 1. PER-SECTION SOURCE MAP (where each section's data comes from)

Legend for availability: **SOURCED** (verbatim in a named file/field), **DERIVABLE**
(reliable from docs+source with normal judgment), **GAP** (not accessible; flag, do not
invent).

| # | Section | Availability | Source file(s) + field(s) |
|---|---|---|---|
| 1 | identity | SOURCED (core) / DERIVABLE (aliases) | `beatsSource.ts` BeatEntry: `id, name, order, path, type, screenId, props`. Aliases (route, `current_step`, `session_log` value, `data-beat-id`) DERIVABLE from beatId + convention (template mirrors beatId across all). The actual PERSISTED alias strings the app writes are app-side (see GAP). |
| 2 | script (+reveal/timing) | SOURCED (lines) / DERIVABLE (reveal+timing) | `beatsSource.ts` `script[]`: `seq, words, bindsTo{kind,element,screen}, voice, clip, clipPath`. `reveal`+`timing` are DERIVABLE from `bindsTo.kind` (bubble = opener, karaoke, no gate; component + empty `words` = silent reveal GATED on prior clip end). Template `scriptMeta` shows the exact derivation. |
| 3 | components | DERIVABLE (key/variant) / GAP (exact on-screen state) | component key = `type` (SOURCED). `variant` = `props.variant` (SOURCED). Resolved-props readout is generated (demoted to derived-debug per spec). EXACT on-screen state (tile label set + count, "1 of 2 selected" text) is `pending:true` in the template; the label lists live in wireframe docs (all-wireframes-2026-05-20, copy-inventory) but are NOT confirmed as the canonical set. Flag pending. |
| 4 | voice | SOURCED / DERIVABLE | engine=`voiceEngine`, mode=`voiceMode` (SOURCED). Per-line live-vs-clip DERIVABLE from `script[].voice`+`clip`+`{name}` slot presence. Mode-enum reconcile (Verbatim/Generative) DERIVABLE per spec. audio-ownership assertion DERIVABLE (only `{name}` lines = live Cartesia; copy-flow rule 19). |
| 5 | rules.context | SOURCED | `coach-per-beat-2026-07-09.md` authors these per beat as `{id,rule,severity,enforcedBy}`; tone rules from `onboarding-copy-flow-rules.md` (1-7, 27-29). enforcer = named QA-eval ids. Also latent in `beatsSource.ts` `context` DO-NOT lines. (Enforcer REALITY = GAP, see 6.) |
| 6 | rules.code | DERIVABLE | `onboarding-behavior-decisions-2026-07-09.md` (the 7 locked decisions) + copy-flow structural rules (8-16) + audit findings, mapped per beat. enforcer basenames named in render-bible-spec (id-alias-check, component-registry-check, advance-gate-check, persistence-contract-check, audio-ownership-check). Whether those checks EXIST/run = GAP. |
| 7 | context (prose) | SOURCED | `beatsSource.ts` `context` field (present on nearly every beat) + `coach-per-beat-2026-07-09.md` refinements. `GLOBAL_CONTEXT` for the shared persona. |
| 8 | allowedTools | SOURCED (list+rules) / GAP (arg schema) | tool list = `beatsSource.ts` `allowedTools` + `beat_contexts.json` (per-beat list). call-rules = `GLOBAL_CONTEXT` "Tools" section + coach-per-beat. PER-TOOL ARG SCHEMA + enums (submit_category's 8 labels) = **GAP**: `beat_contexts.json.allTools` is names only; no schema anywhere; template marks submit_category args `pending:true`. |
| 9 | persistence | SOURCED (contract) / GAP (table+columns) | carry-forward + never-re-ask + resume-key CONTRACT = `GLOBAL_CONTEXT` + decisions 6/7. TABLE + COLUMNS = **GAP**: system-audit explicitly lists persistence as app-code-owned (`current_step`, `session_log.screen_id`, data fingerprints); template says "exact table+column NOT in source or docs, flagged for app-reconcile, do not invent." |
| 10 | flow | DERIVABLE / SOURCED (branches) | advance condition DERIVABLE from `allowedTools`+`expectedResponse`+decisions. Branch logic SOURCED where the `context` states it ("BRANCH THIS SETS UP" on goals/habits; fork beginner/advanced) + decision gates (1 age+gender, 4/5 cap-2-floor-1). gender-routing selector code path = app-side. |
| 11 | edges | DERIVABLE | `GLOBAL_CONTEXT` edge patterns (tool-fail, off-topic, empty-state "ask one neutral question", skip/decline) + per-beat `context` DO-NOTs. Template `edges` shows reliable derivation. enforcer eval:edge-walk (reality = GAP). |
| 12 | acceptance | DERIVABLE | Composite of sections 3/5/9/10 enforcers (shows/says/advances/survives-refresh). Template `acceptance` shows the pattern. Weekly projection numbers now SOURCED (`weekly-projection-rules-APPROVED`: blank 0%, p78=76%, p36=35%, gaps position-anchored). |
| + | applicable-decisions | SOURCED | `onboarding-behavior-decisions-2026-07-09.md` (7 decisions) + the explicit per-beat mapping in `render-bible-spec` section "applicable-decisions". "none" beats are provable-none. |

---

## 2. PER-BEAT SPOT-CHECK (5 diverse beats x 12 sections + dec)

Marks: **S** SOURCED · **D** DERIVABLE · **G** GAP (flag, do not invent).
Beats chosen: category-women (category-select, already fully filled = the template),
goals-sleep→habits (goal + habit-pick), per-habit-ack (the NEW beat), profile-asks
(form/gates), reflection (persistence-heavy).

| section | category-women | habits | per-habit-ack | profile-asks | reflection |
|---|---|---|---|---|---|
| 1 identity | S (filled) | S | **G** (beat not in source; id/order/screenId/prefix TBD, "confirm against render") | S | S |
| 2 script(+reveal/timing) | S/D | S/D | S copy (ack doc, 110 clips) / D reveal | S/D | S/D |
| 3 components | D + G(tiles pending) | D + G(habit label set pending) | D (ack is voice-only, minimal UI) | S(`elements:['age','gender']`) | D (3 styles on screen) |
| 4 voice | S/D | S/D | S (MP3, clip-by-habit-id, ack doc preset) | S/D | S/D |
| 5 rules.context | S (8 rules filled) | D (coach-per-beat + copy-flow 4/5/6) | S (copy-flow 27-29: allude-not-repeat) | D (coach-per-beat) | D (coach-per-beat + copy-flow 7) |
| 6 rules.code | S (filled) | D (decision 4/5 cap-2/floor-1) | D (fires ≤2, pre-schedule, shared→shared clip) | D (decision 1,2) | D (decision 6,7) |
| 7 context | S | S | S (ack doc + copy-flow 27) | S | S |
| 8 allowedTools | S list / **G** enum | S list (add/remove/advance) / **G** arg schema | S (none, or advance only) | S list / **G** submit_profile arg schema | S list / **G** submit_reflection_config + submit_custom_prompts schema |
| 9 persistence | S contract / **G** table | S contract / **G** table+cap-state | **G** (does the ack persist? likely no-write; confirm) | S contract / **G** table (age,gender cols) | S contract (decision 6/7 verbatim) / **G** table+columns |
| 10 flow | S (filled) | D + branch S / **G** cap-gate code path | D (loops per picked habit, ≤2) | D / decision-1 gate S / **G** enforcement path | D / **G** custom-prompt store path |
| 11 edges | S (filled) | D | D (custom habit→fallback clip; ack doc) | D (decline gender: decision 2 hard-reject) | D |
| 12 acceptance | S (filled) | D | D | D | D |
| dec | S (decision 3) | S (decision 4/5) | S (none bind directly) | S (decision 1,2,3-input) | S (decision 6,7) |

Read by column: `identity/script/voice/context/rules.context/applicable-decisions` are
solid across beats. `allowedTools`(arg schema) and `persistence`(table) are GAP on every
data-writing beat. per-habit-ack is the one beat with an identity/structure GAP because
it does not exist as a source entry yet.

---

## 3. DEFINITIVE GAP LIST (flag, do NOT invent)

App-side / not accessible in any read source. The template's correct move is `pending:true`
or "flag for app-reconcile":

1. **Persistence table + columns** (every data-writing beat: profile-asks, state-check,
   checkin, reflection, category, goals, habits, schedule, advanced-*, plan). System-audit
   finding: persistence is app-code-owned (`current_step`, `session_log.screen_id`, data
   fingerprints). No doc names the Supabase table/columns. Template explicitly says do not
   invent a table name.
2. **Per-tool arg schemas + enums** for ALL 14 tools. `beat_contexts.json.allTools` is a
   flat name list; there is no arg schema anywhere. Specifically the **submit_category
   canonical enum** (the 8 category labels) is `pending:true` in the template ("confirm
   canonical enum"). Same for `submit_profile`, `add_habit`, `submit_goals`,
   `submit_reflection_config`, `submit_custom_prompts` payload shapes.
3. **Gender-routing / women-art selector path.** The RULE is SOURCED (decision 3:
   gender==woman only). The actual code selector that swaps the variant is app-side; only
   the rule + its enforcer NAME (component-registry-check) can be written.
4. **Enforcer registration reality** (parity-walk, edge-walk, no-read-options, verbatim-
   opener, and the static checks id-alias-check / component-registry-check /
   advance-gate-check / persistence-contract-check / audio-ownership-check). The enforcer
   STRINGS are writable (named in the spec), but render-bible-spec Open Decision 3 asks
   Yair to confirm the fleet can actually RUN each named eval. So `enforcedBy` values can
   be filled, but their validity is unverified until the checks/evals exist.
5. **Exact on-screen component state** (category tile label set + count, "N of 2 selected"
   counter text). Marked `pending:true`. Label lists exist in wireframe docs but are not
   confirmed canonical; confirm before asserting.
6. **per-habit-ack beat identity + structure.** Copy is 100% SOURCED (ack doc, 110 clips,
   locked preset). But the beat is NOT in `beatsSource.ts`: id, order, screenId, and clip-
   prefix are TBD ("confirm the beat prefix/number against the render"; `onboard_habit_ack_`
   is a clip family, not a beat id). Its identity/flow/persistence cannot be filled until
   the beat entry is created.
7. **vapiAgent spec (flow-layer).** System-audit: the Vapi assistant config drifts in the
   Vapi dashboard and is absent from the render. Flow-layer `vapiAgent` pull-in is flagged
   as possibly out of scope (spec Open Decision 4). Do not reconstruct it from memory.
8. **Persisted alias VALUES** (the literal `current_step` / `session_log` strings the app
   writes per beat, and the non-monotonic persist-step order `1,6,7,8,2,3,4,5` the audit
   notes). The alias CONTRACT is derivable; the exact runtime values are app-side.

---

## 4. BOTTOM LINE FOR THE BUILD

- Solidly SOURCED (fill directly): identity(core), script, voice, context, rules.context,
  applicable-decisions, weekly acceptance numbers.
- DERIVABLE with normal judgment (fill, cite the doc): rules.code (from the 7 decisions),
  flow (advance+branch), edges, acceptance, script reveal/timing, components key/variant.
- GENUINE GAPS (carry as `pending:true` / app-reconcile, NEVER invent): persistence
  table+columns, tool arg schemas + submit_category enum, enforcer registration reality,
  exact tile state, per-habit-ack beat identity, vapiAgent, persisted alias values.

The template (`category-women.bible`) already demonstrates the honest pattern: it fills
10 sections and flags the two app-owned unknowns (persistence table, submit_category enum)
as pending rather than fabricating. A build that copies that discipline fills accurately;
a build that "completes" the pending fields invents.
