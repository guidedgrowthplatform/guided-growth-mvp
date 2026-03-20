---
name: voice-poc
description: Voice command system context — STT providers, prompt engineering, schema, and test scenarios. Auto-invoked when working on voice features, speech-to-text, or the voice command pipeline.
user-invocable: false
---

# Voice POC Reference

This skill provides context for the voice command system.

## Reference Files

- [stt-evaluation.md](stt-evaluation.md) — STT provider comparison (Web Speech API vs DeepGram vs Whisper)
- [prompt-engineering.md](prompt-engineering.md) — Voice command prompt iterations and validation results
- [schema-erd.md](schema-erd.md) — Database schema ERD (Supabase/Postgres)
- [test-scenarios.md](test-scenarios.md) — Voice command test scenarios across 3 tiers

## Architecture

```
Mic (Web Speech API) → STT transcript
  → localParse fallback / GPT-4o-mini → { action, entity, params }
    → ActionDispatcher → DataService
      → UI updates
```

## Key Decisions

- **STT**: Tiered approach — Web Speech API (free default), DeepGram nova-2 (production), Whisper WASM (offline fallback)
- **NLU Model**: GPT-4o-mini with 21 few-shot examples across 3 tiers
- **Validation**: 30/30 (100%) across all tiers
