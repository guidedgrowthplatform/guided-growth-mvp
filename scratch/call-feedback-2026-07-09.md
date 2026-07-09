# Spec-review call feedback — 2026-07-09 (Yair + Mint + Yonas)

Source: Fathom recording 162341344, https://fathom.video/calls/741417002 (~29 min).
Purpose: review the 12-section "Bible" model on the category-women exemplar, decide what to add before scaling. This doc is the actionable extraction that feeds the global-spec update.

## A. GLOBAL SPEC ADDITIONS (apply to ALL beats — the model is missing these)

1. **No-improvisation law + improvise-boundaries.** [22:10-24:50] Yonas raised the LLM improvising as one of the biggest recurring problems. Yair's ruling, verbatim: "LLM cannot improvise, ever, unless it's given a very specific place to improvise. The base is you're not allowed to improvise unless [permitted]." ADD a global rule: improvisation is OFF by default; the model must define exactly WHEN the LLM may improvise and the BOUNDARIES of that improvisation. Yair: "when does the LLM is allowed to improvise, and what are the boundaries? That's something to add."

2. **Global rules layer, on top.** [24:08] Off-topic / out-of-scope handling must live in a global layer at the top that every beat inherits. Yair's examples: "my gender is yellow," "who won the football match yesterday" — what does the coach answer? "The global thing should be on top, and that should answer that specific thing. We do have something like that, I don't know where it is, but it needs to be here." ADD/surface a global rules section (off-topic redirect, out-of-scope answers) and QA it.

3. **Global tool-failure error handling.** [16:45-17:00] Yonas: each beat says "on tool failure, stay on the beat, do not narrate the failure, let the user pick again" — but the model never says HOW the failure is shown. Toast? An AI reply? ADD a global rule for tool-failure surfacing (toast vs coach reply), and whether it differs voice vs text. (Same gap the Fable QA flagged.)

4. **Multi-turn conversation modeling (currently single-turn only).** [17:00-23:53] Yonas: the model as written considers single-turn actions; "it doesn't feel conversational... only considered [one turn]." The back-and-forth with the AI is "the core of everything." The model needs conditional multi-turn rules (if the user says X, reply Y; if Z, reply W), not just a one-shot action per beat. OPEN: Yonas floated this could be a new section 13; Yair leaned toward it belonging in section 5 (coach behavior) but wants it clearer / covered better. NEEDS A RULING (new section vs expand coach-behavior).

5. **Beat-to-beat data passing (global contract).** [24:50-27:40] Yonas: the model never defines how data moves between beats. submit_category sends a category string; the NEXT beat needs that pick. Right now "Claude will improvise by itself, didn't set a rule." PROBLEM: re-fetching the submitted value from the DB / user profile is inefficient and error-prone. SOLUTION (Yonas, verbatim intent): pass data forward via a GLOBAL STATE MANAGER or a QUERY PARAMETER in the URL — get it from the previous beat, do NOT re-read the database after submit. Yonas has a PAST EXAMPLE he built and will share for the AI to reference. ADD: a global data-passing contract + a per-beat data-in / data-out definition.

6. **Make "coach = the LLM" explicit.** [19:42-21:07] Yair: "does this regard the coach really being the LLM? If not, it needs to be clearer." The spot where the LLM connects to the backend is one of the most important parts and it is ambiguous whether the coach-behavior section covers the LLM turn. CLARIFY in the model.

## B. BUGS / PER-SECTION FIXES

7. **Coach-behavior contradiction.** [14:28-15:23] Mint: coach rules say "no praise after the pick / don't say extra things," but the context section says "keep the response specific to their pick." These conflict. Resolve to one canonical rule. (Overlaps the Fable QA's cross-section-duplication finding. Yair notes picks are MP3s so low runtime impact, but still fix.)

8. **First pick-grid option auto-selected.** [15:35-15:52] Mint: the grid should have NOTHING selected on entry; right now the first option is auto-selected. Fix the render/component; check the sibling `category` beat. (Same bug the Fable QA caught at §3.)

## C. RENDER-AS-SOURCE / FILES / SYNC (Yair's closing directive — this is Part B)

9. [27:40] Yair, verbatim: "I want to give the AI all the feedback... the global stuff where we're missing things. All the different files that it has, how it saves the data, maybe some sync rules, how it syncs to Supabase, all that should be, again, on THIS RENDER. This is a lot of stuff for it to build." The render must carry: every file + what it does (A-Z), how data is saved, and the sync rules (including how it syncs to Supabase). Collapsible sections, and it all lands on the Master Sheet.

10. [27:40] Yair: "It's good that you're building the 12, Yonas. That's a test to see how [the shape works], but we're STILL BUILDING THE STRUCTURE." The per-beat 12-section fill is a shape test; the real work now is the global structure (global model + files + sync map).

## D. PROCESS / WORKFLOW

11. Session IDs [07:59-09:35]: multiple sessions on one channel trigger together; each session gets an ID, the conductor routes by ID, NOT separate channels (Yonas's recommendation). STATUS: DONE (shipped this session).
12. Direct-to-conductor [09:41-11:05]: teammates ask the Conductor AI directly for technical setup (e.g. monitor setup), not via Yair.
13. Fable usage [00:36-00:59]: Mint's QA Fable is at extra-high; usage resets ~1h15m after the call start; ping Yair before reset to decide continue/stop; split usage between the QA Fable now and possibly a Yonas Fable on "the bigger one" later.
14. Ownership/reconcile [03:13-06:14]: the build-lead vs Yonas-session collision — Yonas's session correctly said "ask conductor to reconcile first." Resolved.

## E. OPEN DECISIONS (need Yair)

- A. Multi-turn conversation: NEW section 13, or expand section 5 (coach behavior)? (Yair leaned coach-behavior, wants it clearer.)
- B. Coach = LLM: confirm and make explicit in the model.
- Carried from the Fable QA (still open): add "silent after pick" to §5? / coach deliberately neutral on the category screen? / stay-open rule SHOULD vs MUST? / lock the 8 canonical category labels (blocks submit_category).
