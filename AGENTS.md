# AGENTS.md (auto-generated)

This file is the cross-tool entry point for Codex (Desktop / Cloud / CLI), Cursor, and any other agent that reads AGENTS.md. Claude Code uses CLAUDE.md instead (where present in this repo); both load the same underlying content.

**DO NOT EDIT DIRECTLY.** Edit canonical sources in `yair180/yair-ai-files` and run `Yair-Context/bin/sync-agents.sh`.

Last synced: 2026-05-27 21:49 UTC

---

## About this repo

Repo: `gitlab.com/guidedgrowth-group/guided-growth-mvp`

Actual Guided Growth app. React/Vite, Supabase, Vercel, PostHog. Treat app runtime behavior and tests as primary.

---

## Start Here

You are picking up Yair Amsel's work. He moves between Claude Code, Codex Desktop, and Cursor. Do not load the whole second brain by default. Route first, then read only what is needed.

Canonical context lives at:

- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/YAIR.md`
- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/handoffs/INDEX.md`
- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/LIVE.md`
- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/CHANGELOG.md`
- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/projects/`
- `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/areas/`

## Continuation Protocol

When Yair says "continue", "pick this up", "resume", or names a workstream:

1. Read `Yair-Context/handoffs/INDEX.md`.
2. Pick the matching `HANDOFF-<topic>.md`.
3. Read that handoff in full.
4. Read only the repo files, project note, or area note named by the handoff.
5. Execute the exact next action unless the handoff says Yair input is required.

If the topic is ambiguous, list the 2-3 likely active handoff topics and ask Yair to choose. Do not read every handoff to guess.

Before starting substantial work, read `LIVE.md` to avoid duplicating another active Claude or Codex session.

## End-of-Session Protocol

For substantial work, update the relevant topic handoff in `Yair-Context/handoffs/`, update `handoffs/INDEX.md`, refresh `LIVE.md`, and commit/push the relevant repo if the changes are safe to publish. Use the `snapshot-session` skill when the user asks for a handoff.

For project-board state, edit the canonical markdown in `Yair-Context/projects/` or `Yair-Context/areas/`, then run `Yair-Context/bin/build-board.js`.

## Hard Rules

- No em dashes in deliverables. Use hyphens, commas, or rewrite.
- "Yonas" spelling (not "Jonas").
- The product name is "Guided Growth" (never "Daddy Growth").
- Always "hundreds of clients" for Fearless Life public copy.
- Mattermost messages: fenced code blocks with raw markdown.
- Default document delivery: Google Docs, not raw `.md`, unless Yair asks otherwise.
- Do not edit generated `AGENTS.md` directly. Edit `Yair-Context/bin/sync-agents.sh` or canonical context files, then rerun the sync script.

## Fast Commands

- Refresh live snapshot: `/Users/yairamsel/Developer/yair-ai-files/skills/live-snapshot/bin/snapshot.sh`
- Regenerate board: `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/bin/build-board.js`
- Regenerate all AGENTS files: `/Users/yairamsel/Developer/yair-ai-files/Yair-Context/bin/sync-agents.sh`
- Sync provider-agnostic skills: `/Users/yairamsel/Developer/yair-ai-files/skills/sync.sh`

---

<!-- VERCEL BEST PRACTICES START -->

## Best practices for developing on Vercel

These defaults are optimized for AI coding agents and humans working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless and ephemeral. Use Blob or marketplace integrations for preserving state.
- Edge Functions (standalone) are deprecated. Prefer Vercel Functions.
- Do not start new projects on Vercel KV/Postgres, both are discontinued. Use Marketplace Redis/Postgres instead.
- Store secrets in Vercel Env Variables, not in git or `NEXT_PUBLIC_*`.
- Provision Marketplace native integrations with `vercel integration add` when needed.
- Sync env and project settings with `vercel env pull` / `vercel pull` when local/offline parity matters.
- Use `waitUntil` for post-response work. Avoid the deprecated Function `context` parameter.
- Set Function regions near the primary data source. Avoid cross-region DB/service roundtrips.
- Tune Fluid Compute knobs such as `maxDuration`, memory, and CPU for long I/O-heavy calls.
- Use Runtime Cache for fast regional caching and tag invalidation. Do not treat it as global KV.
- Use Cron Jobs for schedules. Cron runs in UTC and triggers the production URL via HTTP GET.
- Use Vercel Blob for uploads/media. Use Edge Config for small globally-read config.
- If Deployment Protection is enabled, use a bypass secret to directly access protected deployments.
- Add OpenTelemetry via `@vercel/otel` on Node. Do not expect OTEL support on the Edge runtime.
- Enable Web Analytics and Speed Insights early.
- Use AI Gateway for model routing when available. Always curl `https://ai-gateway.vercel.sh/v1/models` first; never trust model IDs from memory.
- For durable agent loops or untrusted code, use Workflow (pause/resume/state) plus Sandbox.

<!-- VERCEL BEST PRACTICES END -->
