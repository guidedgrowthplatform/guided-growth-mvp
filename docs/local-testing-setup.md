# Run Guided Growth locally for onboarding voice testing — agent runbook

You are an AI coding agent. Follow these steps in order to bring up the app locally
with **Vapi voice working end-to-end**, then hand the running URL to your human to
test. Run each **Verify** check before moving on; if a check fails, do the **If it
fails** action and do not proceed until it passes.

## Architecture (so you know what you're wiring)

- Web app (Vite) on `http://localhost:5173`, proxies `/api` + `/auth` to `:3000`.
- API (Vercel serverless functions via `vercel dev`) on `http://localhost:3000`.
- Vapi runs in the cloud. It reaches the local API's tool webhook
  (`/api/vapi/tool`) through an **ngrok** tunnel, so the tunnel + a one-time Vapi
  "sync" are required or the coach can't save anything.

## You MUST get these from the human first (you cannot self-provision them)

1. **`.env.local`** — the full secrets file (Supabase, Vapi, Cartesia, OpenAI, JWT…).
   Place it at the repo root. Without it nothing works. Do not print or commit it.
2. **A login** — either Google sign-in is fine, or a test email/password account.
3. **GitLab + Vercel CLI access** — see step 0.

---

## Step 0 — Tooling

```bash
node -v        # need v20.x; if not: nvm install 20 && nvm use 20
npm i -g vercel && vercel login     # any Vercel account; used only to run functions locally
brew install ngrok/ngrok/ngrok      # then: ngrok config add-authtoken <token-from-human>
```

**Verify:** `node -v` prints `v20.*`, `vercel --version` and `ngrok --version` succeed.

## Step 1 — Code + deps

```bash
git clone git@gitlab.com:guidedgrowth-group/guided-growth-mvp.git
cd guided-growth-mvp
git checkout onboarding-cutover
nvm use 20
npm install
printf 'node_modules\nios\nandroid\n.git\ndist\nbuild\nout\ncoverage\n.venv\nvenv\n__pycache__\nsupabase/.temp\n.vercel\n' > .vercelignore
```

**Verify:** `git rev-parse --abbrev-ref HEAD` → `onboarding-cutover`; `npm install` exits 0;
`.vercelignore` exists. (`.vercelignore` prevents `vercel dev` from dying with `EMFILE`.)
**If it fails:** `npm install` errors usually mean wrong Node — re-run `nvm use 20`.

## Step 2 — Place `.env.local`

Put the human-provided `.env.local` at the repo root.
**Verify:** `grep -c '^VITE_VAPI_ASSISTANT_ID=' .env.local` → `1`, and the value is non-empty:
`grep '^VITE_VAPI_ASSISTANT_ID=' .env.local`. Also confirm `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VAPI_PRIVATE_KEY`, `VAPI_WEBHOOK_SECRET` are present and non-empty.
**If it fails:** ask the human for a complete `.env.local`.

## Step 3 — Start the tunnel (own terminal, keep running)

```bash
ngrok http 3000
```

Capture the https forwarding URL (e.g. `https://abcd-12-34.ngrok-free.app`). Programmatic read:

```bash
curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json;print(json.load(sys.stdin)['tunnels'][0]['public_url'])"
```

**Verify:** the URL starts with `https://` and ends in `.ngrok-free.app` (or your ngrok domain).

## Step 4 — Point `.env.local` at the tunnel

Set `VAPI_WEBHOOK_BASE_URL` to the ngrok URL from step 3:

```bash
NGROK_URL="https://abcd-12-34.ngrok-free.app"   # <- use the real one
# replace the line in .env.local (macOS sed):
grep -v '^VAPI_WEBHOOK_BASE_URL=' .env.local > .env.local.tmp && \
  printf 'VAPI_WEBHOOK_BASE_URL=%s\n' "$NGROK_URL" >> .env.local.tmp && mv .env.local.tmp .env.local
```

**Verify:** `grep '^VAPI_WEBHOOK_BASE_URL=' .env.local` shows the ngrok URL.

## Step 5 — Point Vapi's tools at the tunnel

```bash
npm run vapi:sync -- --dev
```

**Verify:** output ends with `Summary: … updated …` and no error. This repoints the 13
Vapi tools to `<ngrok>/api/vapi/tool`. **Re-run this every time the ngrok URL changes.**
**If it fails** with a tunnel-guard error, confirm you passed `-- --dev`.

## Step 6 — Bring up the two servers

Terminal A (API):

```bash
ulimit -n 65536
npm run dev:api          # vercel dev on :3000; first run builds the shared package
```

Terminal B (web):

```bash
npm run dev              # vite on :5173
```

**Verify:**

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/vapi/tool -X POST` → `401`
  (handler is live and refusing unsecured calls — correct).
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` → `200`.
  **If `vercel dev` errors about project access:** `rm -rf .vercel` and re-run `npm run dev:api`
  (functions run locally; env comes from `.env.local`).

## Step 7 — Hand off to the human to test

Tell the human to open **http://localhost:5173**, sign in (Google or the test account),
**allow microphone access**, and start onboarding. A fresh account goes straight into
onboarding; to re-test an existing account, the human asks Yonas to reset its onboarding.

---

## What the human should look for

1. **Opener** lights up word-by-word **in sync with the Cartesia voice**, rendered from
   the actual transcript (not pre-written text up front).
2. **One bubble per turn** — a turn is a single growing bubble; no "splits into two then
   collapses to one."
3. **Card in the timeline** — the beat's component sits right after the opener
   (opener → card → replies), not below the whole conversation.
4. **Refresh mid-onboarding** restores the full conversation, in order — nothing vanishes.
5. **No duplicate opener** on stop/refresh of a beat.
6. **All beats engage live** (beginner + advanced): habit add/configure, plan review,
   morning setup, reflection.

## Operational notes

- ngrok (free) issues a **new URL each restart** → on any restart, redo steps 4–5.
- `vapi:sync -- --dev` points the **shared** Vapi tools at this machine, so **only one
  tester at a time**; Yonas re-syncs the hosted URL afterward.
- Hard dependency: `vercel dev` (the only local API runner). If it can't start, the API
  is down and onboarding will fail on the first save/tool call.
