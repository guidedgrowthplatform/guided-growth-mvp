---
name: product
description: Product specs and roadmap for Guided Growth App. Auto-invoked when discussing feature scope, what to build next, MVP boundaries, the roadmap, or specs for onboarding, core tracking, feedback loop, or data visibility. Skip for pure implementation/code questions.
user-invocable: false
---

# Product

Source-of-truth product context for Guided Growth App. Use this to answer "what are we building", "what's in scope", or "where does X feature fit".

## Reference Files

- [overview.md](overview.md) — what the app is, problems it solves, key features
- [roadmap.md](roadmap.md) — numbered roadmap of all sections (built + planned)
- [conventions.md](conventions.md) — UX conventions shared across all sections (input modalities, accessibility, responsiveness, persistence)

## Section Specs

Specs only exist for sections that have been written up. Sections in the roadmap without a file here are intentionally not yet specced.

- [sections/core-tracking.md](sections/core-tracking.md) — daily entry, habit management, journaling management
- [sections/onboarding.md](sections/onboarding.md) — first-run personalization flow
- [sections/feedback-loop.md](sections/feedback-loop.md) — completion feedback, recovery, weekly review, insight nudges
- [sections/data-visibility.md](sections/data-visibility.md) — dashboards, drill-downs, comparisons, exports

## Related Skills

- `voice-architecture` — umbrella for the 3-path voice/chat model (Vapi onboarding / async check-ins / direct LLM chat). Start here for any voice question.
- `path-1-vapi` — onboarding voice (Vapi assistant; legacy Cartesia Line code)
- `path-2-async` — daily check-ins, journal/feedback voice, single-utterance commands (MP3 + Cartesia Ink + callLLM + Sonic; legacy REST + GPT-4o-mini NLU)
- `path-3-direct-llm` — text chat surfaces and tap-driven LLM calls
- `naming-conventions` — file/folder naming when implementing features from specs
- `frontend-design` — UI guidelines when building screens from specs
