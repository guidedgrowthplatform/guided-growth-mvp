# Cartesia Line Agent (Realtime Voice) — Deploy + Test

This folder contains the **Cartesia Line agent** prototype used for **realtime voice conversations** (STT → LLM → TTS streamed back).

It is **not** a Vercel `/api/*` function. It runs on Cartesia’s hosted agent platform after `cartesia deploy`.

## What you deploy

- Entry point (Line SDK / recommended): `scripts/cartesia-line-agent/main.py`
- Legacy prototype (older API): `scripts/cartesia-line-agent/agent.py`
- The agent defines:
  - LLM: `openai/gpt-4o-mini`
  - Voice: Cartesia Sonic voice (configurable via `CARTESIA_VOICE_ID`)
  - Tool: `get_user_context()` which pulls profile + habits from Supabase (optional)

## Required environment variables (on Cartesia platform)

Minimum (agent can respond):

- `OPENAI_API_KEY`

Optional (enables Supabase-powered personalization in `get_user_context()`):

- `SUPABASE_URL` (preferred) **or** `VITE_SUPABASE_URL` (legacy fallback)
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (voice selection):

- `CARTESIA_VOICE_ID`

## Deploy (Cartesia CLI)

1. Install Cartesia CLI (once):
   - `curl -fsSL https://cartesia.sh | sh`
   - `cartesia update` (optional, later)
2. Login/auth:
   - `cartesia auth login`
3. Deploy the agent:
   - `cd scripts/cartesia-line-agent`
   - `cartesia init` (create/link an agent in your org)
   - `cartesia deploy`
4. In the Cartesia dashboard (or via CLI), set the env vars listed above for the deployed agent.

## Test before frontend wiring

Use Cartesia’s CLI chat tool against the deployed agent:

- Local test:
  - Terminal 1: `OPENAI_API_KEY=... PORT=8000 uv run python main.py`
  - Terminal 2: `cartesia chat 8000`

Confirm:

- The agent starts and responds.
- If you set Supabase env vars, the agent can fetch `profiles` + `user_habits` without errors.

## Frontend wiring (later)

The React hook `src/hooks/useRealtimeVoice.ts` is a placeholder until a Line agent is deployed.
Once you have the deployed agent’s identifier/URL, implement the TODOs there to connect via WebSocket / `@cartesia/cartesia-js`.
