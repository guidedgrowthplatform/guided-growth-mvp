# Prompt Engineering — Voice Command Processor

Last validated: 2026-03-04 | Model: `gpt-4o-mini`

## Prompt Iterations

### v1 — Inline Baseline (MVP-03)

- 10 few-shot examples, inline in `api/process-command.ts`
- No edge case handling, no validation suite
- Works for happy-path commands, fails on filler words / typos / casual speech

### v2 — Extracted + Expanded (MVP-04)

- Extracted to `src/lib/prompts/voice-command-system.ts`
- 21 few-shot examples across 3 tiers + edge cases
- Added structured parse rules (17 rules covering filler, typos, casual speech)
- Added confidence calibration guidelines
- `response_format: { type: 'json_object' }` for guaranteed JSON

## Validation Results (v2)

```
Tier 1: 11/11 (100%) — target ≥90% ✅
Tier 2: 10/10 (100%) — target ≥80% ✅
Tier 3:  9/9  (100%) — target ≥60% ✅
Overall: 30/30 (100%)
```

### Performance

| Metric          | Value       |
| --------------- | ----------- |
| Avg latency     | 1118ms      |
| Avg tokens/call | 1628        |
| Model           | gpt-4o-mini |
| Temperature     | 0.1         |
| Max tokens      | 200         |

## Cost Analysis

| Scale                      | Monthly Cost |
| -------------------------- | ------------ |
| 100 daily users × 10 cmds  | ~$18/mo      |
| 500 daily users × 10 cmds  | ~$92/mo      |
| 1000 daily users × 10 cmds | ~$183/mo     |

Pricing: gpt-4o-mini input $0.15/1M tokens, output $0.60/1M tokens

## Key Prompt Design Decisions

1. **Single-action only** — one intent per transcript, avoids multi-intent ambiguity
2. **Low temperature (0.1)** — deterministic parsing, reduces hallucination
3. **Never return "unknown"** — always make best guess, confidence signals uncertainty
4. **Filler word stripping** — explicit rule to handle "um", "like", "please"
5. **Typo tolerance** — few-shot example with misspelled input demonstrates graceful handling
6. **Confidence calibration** — 0.9+ clear, 0.7-0.89 likely, 0.5-0.69 guess, <0.5 unclear

## Test Scenarios

Full test cases with 30 scenarios available in `scripts/validate-prompt.ts`.
Results documented in [test-scenarios.md](test-scenarios.md).
