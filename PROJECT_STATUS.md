# Guided Growth MVP — Project Summary

> Last updated: 2026-03-03

## Roadmap Status

| #       | Issue | Title                                          | Status         | Branch                         | MR            |
| ------- | ----- | ---------------------------------------------- | -------------- | ------------------------------ | ------------- |
| MVP-01  | #10   | Scaffold Next.js + Capacitor voice POC         | ✅ Merged      | —                              | !12 (merged)  |
| MVP-02  | #11   | STT evaluation (Web Speech, Deepgram, Whisper) | ✅ Ready       | `feat/stt-evaluation-clean`    | !15           |
| MVP-03  | #12   | Voice command testing + MockDataService        | ✅ Pushed      | `feat/voice-mock-testing`      | — (create MR) |
| MVP-04  | #13   | Prompt engineering & validation                | ❌ Not started | `feat/prompt-engineering`      | —             |
| MVP-05  | #14   | Supabase data layer + schema                   | ❌ Not started | `feat/supabase-implementation` | —             |
| MVP-06  | #15   | E2E voice demo (Supabase swap)                 | ❌ Not started | `feat/voice-e2e-demo`          | —             |
| PROD-01 | #16   | 3-tier LLM routing                             | ❌ Not started | —                              | —             |

## Meeting Pipeline (separate repo)

| MR  | Title                                    | Status   |
| --- | ---------------------------------------- | -------- |
| !3  | Multi-account Fathom support             | ✅ Ready |
| !4  | Per-task edit button + Yair-less support | ✅ Ready |

## Architecture Flow (MVP-03)

> **Superseded — historical.** This MVP-03 voice-command pipeline (process-command → ActionDispatcher → commandStore → VoiceTranscript) has been retired. Home check-ins now run on the CoachChat / `callLLM` (`/api/llm`) path; the frontend NLU engine files listed below no longer exist. See the `voice-architecture` / `path-2-async` / `path-3-direct-llm` skills for the current model.

```
User speaks
  → Web Speech API (mic button)
    → transcript text
      → GPT-4o-mini (/api/process-command)
        → { action, entity, params, confidence }
          → ActionDispatcher
            → MockDataService (localStorage)
              → Toast notification + page navigation
```

## Key Files (MVP-03)

| File                                         | Purpose                                  |
| -------------------------------------------- | ---------------------------------------- |
| `src/lib/services/data-service.interface.ts` | Abstract contract (mock ↔ Supabase swap) |
| `src/lib/services/mock-data-service.ts`      | localStorage CRUD + seed data            |
| `src/lib/services/action-dispatcher.ts`      | Maps intent → DataService calls          |
| `api/process-command.ts`                     | Vercel serverless GPT-4o-mini            |
| `src/hooks/useVoiceCommand.ts`               | Pipeline hook (+ local fallback parser)  |
| `src/stores/commandStore.ts`                 | Zustand state for command processing     |
| `src/components/voice/VoiceTranscript.tsx`   | UI: auto-process + result display        |

## Git Remotes

| Remote   | URL                                                 | Use                              |
| -------- | --------------------------------------------------- | -------------------------------- |
| `origin` | `gitlab.com/guidedgrowth-group/guided-growth-mvp`   | Primary (Alejandro reviews here) |
| `github` | `github.com/guidedgrowthplatform/guided-growth-mvp` | Vercel auto-deploy (connected)   |

## Vercel

- **Project**: `guided-growths-projects/guided-growth-mvp`
- **Connected to**: GitHub (not GitLab)
- **⚠️ Author restriction**: commits by `imsaidm` blocked — need Alejandro to add to team
- **Production URL**: `guided-growth-mvp.vercel.app`

## STT Decision

**Winner: Whisper.cpp** (best speed/accuracy balance)

- Fallback: Web Speech API (free, browser-native)
- Alternative: Deepgram (fastest, paid)

## Next Steps

1. Create MR for `feat/voice-mock-testing` on GitLab
2. Start MVP-04: prompt validation (90%/80%/60% accuracy targets)
3. Ask Alejandro to add `imsaidm` to Vercel team
