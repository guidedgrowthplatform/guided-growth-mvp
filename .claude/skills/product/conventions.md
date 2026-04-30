# Shared UX Conventions

Conventions every section spec should assume unless it explicitly overrides them. Sections reference this file rather than repeating these requirements inline.

## Multi-Modal Input

Every text input supports three modes:

- **Type** — keyboard input
- **Copy/paste** — works seamlessly in all text fields
- **Basic speech-to-text** — voice-to-text conversion treated identically to typed input. Visual recording indicator while active.

Note: "basic STT" means voice → text only. Conversational AI, voice coaching, and intelligent voice interactions are out of scope here and live in the AI Voice section (roadmap §3). See the `voice-commands` and `voice-assistant` skills for implementation.

## Responsive Design

- Mobile-friendly layouts and touch-optimized interactions
- Keyboard shortcuts work on desktop
- Voice input accessible on mobile

## Accessibility

- Full keyboard navigation
- Screen-reader friendly
- Visible focus indicators
- Voice input as alternative input method
- Clear visual feedback for every action

## Data Persistence

- Auto-save on change in most surfaces; explicit Save only in Form view
- Server-backed persistence (Supabase); offline saves are queued in localStorage and flushed on reconnect
- All views respect user-specific data isolation — exports never include other users' data

## Data Model

Specs describe user-visible behavior, not schema. The data structure for habits, journal entries, and user data is defined in code (`packages/shared/src/types/index.ts`) and migrations (`supabase/migrations/`), not here.
