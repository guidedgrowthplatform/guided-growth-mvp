---
name: frontend-design
description: Guidelines for building UI components in this project. Auto-invoked when creating new pages, components, or layouts.
user-invocable: false
---

# Frontend Design Guidelines

## Stack
- React 18 + TypeScript + Tailwind CSS
- Icons: `@iconify/react` with `mdi:` prefix
- Routing: React Router v6

## Component Structure
- One component per file, named export matching filename
- Props interface defined above the component
- Barrel export from `index.ts` in each component folder

## Layout
- `Layout.tsx` provides `px-4` horizontal padding — child pages must NOT add their own
- Pages use `pb-8 pt-2` for vertical spacing
- Use `space-y-6` or `flex flex-col gap-N` for vertical rhythm

## Styling Patterns
- Use design tokens from Tailwind config: `text-content`, `text-content-secondary`, `bg-surface`, `border-border-light`, `bg-primary`, `bg-primary-dark`
- Rounded corners: `rounded-2xl` for cards, `rounded-full` for pills/buttons
- Shadows: `shadow-sm` for cards
- Transitions: `transition-all duration-300 ease-in-out`

## Animations
- Expand/collapse: Use CSS grid trick (`grid-rows-[1fr]`/`grid-rows-[0fr]` + `overflow-hidden`)
- Fade: `opacity-0`/`opacity-100` with transition

## Toast
- Import `useToast` from `@/contexts/ToastContext`
- Call `addToast('success' | 'error', message)`
