# Beats: one file per beat, design in parallel

A beat is a list of **steps** played in order. This folder lets several sessions
build different beats at the same time without touching the same file.

## The model

A step is one part of a beat:

| Step | Renders |
|------|---------|
| `{ speaker: 'coach', say: '...' }` | a white bubble the coach speaks (karaoke reveal) |
| `{ speaker: 'coach', say: '...', render: <X/> }` | the coach speaks AND a component appears |
| `{ speaker: 'coach', render: <X/> }` | a component only, no voice |
| `{ speaker: 'user', say: '...' }` | a blue bubble the user answers in (karaoke) |

The player fades each step in and waits for the spoken line to finish before the
next. The phone frame, the gradient background, the orb, and the transitions are
handled for you by the canvas; a beat only defines its steps.

## To build a beat

1. Copy `_TEMPLATE.tsx` to `beats/<your-beat>.tsx`. You own that file.
2. Write the steps. Read editable copy from `props` (e.g. `props?.greeting`).
3. To reveal a real component, import it from `@/components/...` and put it in a
   step's `render`. Use the existing palette as the menu of components.
4. Default-export one `BeatDef` with a unique `type`, a `group`, a `label`, and
   your `Comp`. The registry auto-collects it, no other edits needed.
5. `profile.tsx` is the worked example. Copy its shape.

## Rules

- Import the shared pieces from `../beatKit` (BeatPlayer, Karaoke, BeatStep,
  BeatDef). Never copy them.
- One beat per file, one `default` export per file.
- Do not edit `beatKit.tsx`, `index.ts`, or another session's beat file.
- No em dashes in any user-facing copy.
