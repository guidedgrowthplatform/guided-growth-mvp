# R&D1-03: Research TTS and Speech Recognition Adaptation for Product Specialization

### Issue #57 — Sprint 3: Voice Semantics & Adaptation R&D

**Date:** 2026-03-31
**Author:** Abdullah Said Mustaqim
**Status:** Complete
**Related:** Issue #55 (VibeVoice Testing), Issue #56

---

## Executive Summary

This report evaluates strategies to specialize text-to-speech (TTS) and speech recognition (ASR/STT) for GuidedGrowth's habit-tracking context. We assess custom LLM training, domain-adapted ASR, branded TTS voices, and enhanced semantic parsing — comparing effort, cost, and expected impact.

### Key Recommendation

> **Phase 1 (Now):** Enhanced prompt engineering + domain vocabulary injection in the GPT parsing pipeline — **zero infra cost, immediate impact.**
>
> **Phase 2 (Sprint 4-5):** Hybrid ASR with VibeVoice hotwords as fallback; keyword boosting on DeepGram.
>
> **Phase 3 (Post-MVP):** Fine-tuned Whisper LoRA for GuidedGrowth domain; custom branded TTS voice.

---

## 1. Current Architecture Analysis

### 1.1 Current Voice Pipeline

```
User speaks → ElevenLabs Scribe v1 (STT)
            → Raw transcript (often garbled)
            → GPT-4o-mini parse (with 478-line system prompt)
            → Structured JSON command
            → ActionDispatcher executes
```

### 1.2 Known Pain Points

| Problem                                                | Root Cause                                | Current Workaround                 |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------- |
| "Mark meditation done" → "Mark made a champagne toast" | ElevenLabs hallucinates on short commands | 35+ garbled examples in GPT prompt |
| Domain terms misrecognized                             | No custom vocabulary in STT               | GPT corrects phonetically          |
| Robotic TTS voice                                      | Browser SpeechSynthesis                   | No workaround                      |
| Large system prompt (~478 lines)                       | STT error correction burden on GPT        | None (adds latency + cost)         |
| No offline capability                                  | Cloud-only STT                            | Whisper WASM fallback (tier 3)     |

### 1.3 Current Cost Per Voice Command

```
ElevenLabs STT:   ~$0.0067/command (avg 1s audio)
GPT-4o-mini:      ~$0.0003/command (478-line prompt + response)
Total:            ~$0.007/command → $7 per 1,000 commands
```

---

## 2. Adaptation Strategy Brainstorm

We evaluated **6 strategies** across 3 dimensions: STT adaptation, semantic parsing, and TTS customization.

### Strategy Matrix

| #   | Strategy                             | Effort       | Cost         | Impact    | Priority   |
| --- | ------------------------------------ | ------------ | ------------ | --------- | ---------- |
| A   | Enhanced GPT Prompt (domain vocab)   | 🟢 Low       | $0           | 🟡 Medium | ⭐ **Now** |
| B   | ASR Keyword Boosting (DeepGram)      | 🟢 Low       | $0           | 🟢 High   | ⭐ **Now** |
| C   | VibeVoice Hotwords (hybrid fallback) | 🟡 Medium    | Free-$75/mo  | 🟢 High   | Sprint 4   |
| D   | Whisper LoRA Fine-tuning             | 🔴 High      | GPU + data   | 🟢 High   | Post-MVP   |
| E   | Custom Branded TTS Voice             | 🔴 High      | GPU + studio | 🟡 Medium | Post-MVP   |
| F   | Custom Intent LLM (fine-tuned)       | 🔴 Very High | GPU + data   | 🟡 Medium | Future     |

---

## 3. Strategy Details

### 3.1 Strategy A: Enhanced GPT Prompt (Domain Vocabulary Injection)

**Effort:** 2-4 hours | **Cost:** $0 | **Impact:** Medium

The current system prompt already has extensive few-shot examples for garbled transcripts. We can enhance it further:

#### Proposed Changes to `process-command.ts`

```diff
 const SYSTEM_PROMPT = `You are the voice command processor for "Life Tracker"...

+## Domain Vocabulary
+The following terms are specific to this app and should be preserved exactly:
+- GuidedGrowth (brand name — never "guided growth" or "guide growth")
+- check-in (hyphenated — not "checking" or "check in")
+- habit streak (compound term — not "have it streaked")
+- journaling, meditation, hydration tracking, gratitude practice
+- pomodoro, focus session, digital detox
+- mood tracking, sleep quality, energy level, stress level
+
+When the STT transcript contains words phonetically similar to these terms,
+always correct to the exact domain vocabulary above.
+
 ## Transcript Correction Rules
```

#### Expected Impact

- 10-15% improvement in domain term recognition accuracy
- No increase in API calls or infrastructure
- Reduces confidence score drops from misrecognized terms

---

### 3.2 Strategy B: ASR Keyword Boosting (DeepGram)

**Effort:** 1-2 hours | **Cost:** $0 (already have DeepGram API key) | **Impact:** High

DeepGram Nova-2 (already configured as Tier 2 STT) supports **keyword boosting** via the `keywords` parameter:

```typescript
// In deepgram STT configuration
const options = {
  model: 'nova-2',
  language: 'en',
  keywords: [
    'GuidedGrowth:2', // boost factor 2x
    'check-in:1.5',
    'meditation:1.5',
    'journaling:1.5',
    'habit streak:1.5',
    'pomodoro:1.5',
    'focus session:1.5',
  ],
};
```

#### Expected Impact

- 20-30% improvement in domain-specific term accuracy
- Works at the STT level — reduces burden on GPT correction
- No additional cost (keyword boosting is included in DeepGram pricing)

---

### 3.3 Strategy C: VibeVoice Hotwords (Hybrid Fallback)

**Effort:** 1-2 weeks | **Cost:** Free (HF Spaces) to $75/mo (Replicate) | **Impact:** High

From Issue #55 research, VibeVoice-ASR supports custom hotwords via `context_info`:

```python
# VibeVoice with GuidedGrowth hotwords
result = client.predict(
    media_input=audio_file,
    context_info="GuidedGrowth, check-in, meditation, journaling, habit streak, mood tracking",
    api_name="/predict",
)
```

#### Integration Architecture

```
Audio → ElevenLabs (primary, fast ~1-2s)
     ↓ if confidence < 0.7
     → VibeVoice + hotwords (retry, accurate ~5-10s)
     → GPT parse
```

#### Expected Impact

- Domain terms recognized with near-100% accuracy with hotwords
- Higher latency on retry path (3-10s vs 1-2s)
- Free with HuggingFace Spaces (subject to queue)

---

### 3.4 Strategy D: Whisper LoRA Fine-tuning

**Effort:** 2-4 weeks | **Cost:** ~$50-200 training, GPU hosting | **Impact:** High

Train a domain-specific Whisper adapter using LoRA (Low-Rank Adaptation):

#### Data Requirements

| What                 | Amount          | How to Get                     |
| -------------------- | --------------- | ------------------------------ |
| Paired audio-text    | 5-10 hours      | Record users + synthetic TTS   |
| Domain-specific text | 1,000+ commands | Generate from command patterns |
| Validation set       | 1 hour          | Hold out from training data    |

#### Training Pipeline

```
1. Collect domain audio (GuidedGrowth commands)
2. Generate synthetic audio using TTS for augmentation
3. Fine-tune Whisper-small with LoRA adapters (~0.1% params)
4. Deploy adapter alongside base Whisper model
5. A/B test against ElevenLabs
```

#### Key Techniques

- **LoRA**: Only trains ~0.1-1% of parameters, runs on consumer GPU
- **Synthetic Data**: Use TTS to generate 1000s of GuidedGrowth commands
- **Text-Only Adaptation**: New research shows decoder-only fine-tuning with domain text (no audio needed)
- **Avoid Catastrophic Forgetting**: Stop training when validation WER plateaus

#### Expected Impact

- 30-50% WER reduction on domain-specific terms
- Sub-second latency (local inference)
- Full offline capability
- One-time training cost, ongoing GPU hosting

---

### 3.5 Strategy E: Custom Branded TTS Voice

**Effort:** 3-6 weeks | **Cost:** Studio recording + GPU | **Impact:** Medium (UX differentiation)

#### Current State

Browser `SpeechSynthesis` API — functional but robotic, no brand identity.

#### Open-Source Options (2026)

| Model                       | Strength                 | Latency | Best For             |
| --------------------------- | ------------------------ | ------- | -------------------- |
| **Chatterbox**              | Lightweight, MIT license | ~100ms  | Real-time assistants |
| **Fish Speech V1.5**        | High-quality cloning     | ~200ms  | Premium voice        |
| **CosyVoice2**              | Emotional control        | ~150ms  | Empathetic coaching  |
| **VibeVoice-Realtime-0.5B** | Natural pacing           | ~300ms  | Conversational       |
| **XTTS-v2** (community)     | Multilingual, proven     | ~500ms  | Flexible deployment  |

#### Recommended Path for GuidedGrowth

1. **Phase 1**: Use `Chatterbox` or `CosyVoice2` with zero-shot cloning from a reference voice
2. **Phase 2**: Record 30-60 minutes of a professional voice actor
3. **Phase 3**: Fine-tune model on recorded data for consistent branded voice

#### Coaching Voice Persona Concept

```
Name: "Guided" (the coaching assistant)
Tone: Warm, encouraging, calm
Style: Conversational pacing with subtle emotional variation
Use Cases:
  - "Great job! You've maintained your meditation streak for 7 days!"
  - "Time for your evening check-in. How are you feeling?"
  - "You're almost at your weekly goal. Just one more session!"
```

---

### 3.6 Strategy F: Custom Intent Classification LLM

**Effort:** 4-8 weeks | **Cost:** GPU training + hosting | **Impact:** Medium

#### Current vs Proposed

| Aspect       | Current (GPT-4o-mini)        | Fine-tuned Small LLM                   |
| ------------ | ---------------------------- | -------------------------------------- |
| Model        | GPT-4o-mini (cloud)          | Llama-3-8B or Mistral-7B (self-hosted) |
| Latency      | ~300-500ms                   | ~50-100ms                              |
| Cost/command | ~$0.0003                     | ~$0.0001 (GPU amortized)               |
| Accuracy     | High (with 478-line prompt)  | Higher (domain-trained)                |
| Offline      | ❌                           | ✅                                     |
| Flexibility  | ✅ (change prompt instantly) | ❌ (retrain for new intents)           |

#### When to Consider

- **Only if** volume exceeds 10,000 commands/day
- **Only if** GPT-4o-mini latency is a bottleneck
- **Only if** the team has ML engineering capacity

#### Better Alternative: Function Calling + Structured Outputs

Instead of fine-tuning a full LLM, use OpenAI's **function calling** with strict JSON schema:

```typescript
// Replace raw JSON prompt with function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'execute_command',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'complete', 'delete', 'log', 'query', 'reflect'],
          },
          entity: { type: 'string', enum: ['habit', 'metric', 'journal', 'summary'] },
          params: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['action', 'entity', 'params', 'confidence'],
      },
    },
  },
];
```

This provides strict schema validation without fine-tuning, reducing hallucination risk.

---

## 4. Feasibility Assessment: Custom Trained LLM

### 4.1 What Would a "Custom LLM" Look Like?

| Approach                  | Description                                | Feasibility                     |
| ------------------------- | ------------------------------------------ | ------------------------------- |
| **Full pre-training**     | Train from scratch on habit/wellness data  | ❌ Impractical ($100K+, months) |
| **Fine-tune GPT**         | OpenAI fine-tuning API on command examples | 🟡 Medium ($50-200, 1-2 weeks)  |
| **Fine-tune open-source** | LoRA on Mistral-7B with command pairs      | 🟡 Medium (GPU needed)          |
| **RAG + Embeddings**      | Vector DB of habit terms + LLM query       | 🟢 High (low cost, fast)        |
| **Function calling**      | GPT with strict schema + few-shot          | 🟢 Highest (current infra)      |

### 4.2 Recommendation: RAG Hybrid Over Custom LLM

Instead of training a custom LLM, implement a **hybrid intent classification** system:

```
Voice transcript
    ↓
┌─────────────────────────────────────┐
│ Fast Path: Embedding Similarity     │ < 10ms
│ (compare against 50 intent vectors) │
│ → High-confidence? → Execute        │
└───────────────┬─────────────────────┘
                │ Low confidence
                ↓
┌─────────────────────────────────────┐
│ Slow Path: GPT-4o-mini             │ ~300ms
│ (full prompt with context)          │
│ → Parse + validate → Execute        │
└─────────────────────────────────────┘
```

**Benefits:**

- 80% of common commands handled in <10ms (embedding match)
- Complex/ambiguous commands still get full GPT parsing
- No custom model training required
- Cheaper at scale ($0 for fast path vs $0.0003/GPT call)

---

## 5. Implementation Roadmap

### Phase 1: Quick Wins (This Sprint) — 0 cost, 4-6 hours

| Task                                        | File                     | Impact                              |
| ------------------------------------------- | ------------------------ | ----------------------------------- |
| Add domain vocabulary section to GPT prompt | `api/process-command.ts` | 10-15% accuracy ↑                   |
| Add DeepGram keyword boosting               | STT config               | 20-30% domain accuracy ↑            |
| Switch to OpenAI function calling           | `api/process-command.ts` | Stricter output, less hallucination |

### Phase 2: Hybrid ASR (Sprint 4-5) — <$75/mo

| Task                                           | Impact                                |
| ---------------------------------------------- | ------------------------------------- |
| Integrate VibeVoice hotwords as retry fallback | Near-100% domain accuracy on retry    |
| Implement confidence-based routing             | Best of both worlds: speed + accuracy |
| Add user feedback loop for misrecognitions     | Training data collection for Phase 3  |

### Phase 3: Deep Specialization (Post-MVP) — $200-500 setup

| Task                                             | Impact                                |
| ------------------------------------------------ | ------------------------------------- |
| Whisper LoRA fine-tuning with domain data        | 30-50% WER reduction, offline-capable |
| Custom branded TTS voice (Chatterbox/CosyVoice2) | Premium UX differentiation            |
| Embedding-based fast intent classifier           | Sub-10ms for common commands          |

---

## 6. Acceptance Criteria Status

| Criteria                                        | Status   | Evidence                                           |
| ----------------------------------------------- | -------- | -------------------------------------------------- |
| ✅ Brainstorming session: adaptation strategies | Complete | 6 strategies evaluated (Section 2-3)               |
| ✅ Evaluate custom LLM feasibility              | Complete | Section 4 — RAG hybrid recommended over custom LLM |
| ✅ Document findings and recommendations        | Complete | Full report with roadmap (Section 5)               |

---

## 7. References

- Issue #55: VibeVoice Comprehensive Testing Report (`research/vibevoice/REPORT.md`)
- Current GPT system prompt: `api/process-command.ts` (lines 232-478)
- DeepGram keyword boosting: [docs.deepgram.com/keyword-boosting](https://developers.deepgram.com/docs/keywords)
- Whisper LoRA fine-tuning: HuggingFace Transformers + PEFT library
- Open-source TTS landscape 2026: Chatterbox, Fish Speech V1.5, CosyVoice2

---

## Appendix A: GuidedGrowth Domain Vocabulary List

```
# Core terms
GuidedGrowth, Life Tracker, habit tracker

# Actions (command words)
mark done, check in, check-in, log, create, delete, focus session, pomodoro

# Entity names
habit streak, journaling, meditation, exercise, hydration tracking,
gratitude practice, deep breathing, yoga, digital detox, cold shower,
morning routine, sleep quality, mood tracking, energy level, stress level

# Temporal
today, yesterday, this week, this month, past N days, last N days

# Numeric
[1-10] scale, hours, minutes, out of [10]
```

## Appendix B: Proposed Domain Vocabulary Prompt Enhancement

```
## Domain Vocabulary
The following terms are specific to this app. Preserve them exactly:
- "GuidedGrowth" (brand — never split as "guided growth")
- "check-in" (hyphenated compound — not "checking" or "check in")
- "habit streak" (compound metric — not "have it streaked")
- "focus session" / "pomodoro" (timer feature)
- "journaling", "meditation", "hydration tracking", "gratitude practice"
- "mood tracking", "sleep quality", "energy level", "stress level"

When transcript contains words phonetically similar to these, always
correct to the exact domain vocabulary above. Priority order:
1. Exact match in user's existing habits list
2. Domain vocabulary match
3. Phonetic similarity match
4. Use as-is (treat as new term)
```
