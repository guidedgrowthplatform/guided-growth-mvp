#!/bin/zsh -l
# Serves the Guided Growth FLOW BUILDER as a static build on a dedicated port (7333),
# at the clean root URL. Builder ONLY (no app routes), so nothing interferes. A
# background loop keeps it fresh: rebuilds within ~15s of any change (local edits,
# new commits, or a safe fast-forward of other sessions' pushed work).
set -e
cd "$HOME/Developer/ggmvp-flow-builder" || exit 1
SERVE="$HOME/.flow-builder-served"
MARK="/tmp/flow-builder-last-build"
PY="$(command -v python3)"
WR="$(command -v wrangler 2>/dev/null || echo "$HOME/Developer/gg-cron-worker/node_modules/.bin/wrangler")"
mkdir -p "$SERVE"

build() {
  /usr/local/bin/npx vite build --config vite.flow.config.ts --base=/ >>/tmp/flow-builder-build.log 2>&1 || return 1
  [ -f dist-flow/flow-standalone/index.html ] && cp dist-flow/flow-standalone/index.html dist-flow/index.html
  rsync -a --delete dist-flow/ "$SERVE/" 2>/dev/null
  date > "$MARK"
}

# Also push the freshest build to the public Cloudflare Pages URL
# (gg-flow-builder.pages.dev), so the hosted page tracks the repo. Uses the
# already logged-in wrangler. Best-effort, never blocks the local serve.
deploy_page() {
  [ -x "$WR" ] || return 0
  "$WR" pages deploy "$SERVE" --project-name=gg-flow-builder --branch=main --commit-dirty=true \
    >>/tmp/flow-builder-deploy.log 2>&1 || true
}

# seed the serve dir with the last good build so it is never empty, then rebuild fresh
rsync -a dist-flow/ "$SERVE/" 2>/dev/null || true
build || true

# freshness loop: safe ff-pull of a CLEAN tree (never conflicts / never disturbs WIP),
# then rebuild if HEAD moved or any source changed
(
  LAST=""
  DEPLOYED=""
  while true; do
    if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
      git fetch origin flow-builder-onboarding -q 2>/dev/null || true
      git merge --ff-only origin/flow-builder-onboarding -q 2>/dev/null || true
    fi
    HEAD="$(git rev-parse HEAD 2>/dev/null)"
    CHANGED="$(find src vite.flow.config.ts -type f -newer "$MARK" 2>/dev/null | head -1)"
    if [ "$HEAD" != "$LAST" ] || [ -n "$CHANGED" ]; then build && LAST="$HEAD"; fi
    # Push the public page only when a new commit landed (not on every local-edit
    # rebuild), so the hosted URL tracks pushed work.
    if [ "$HEAD" != "$DEPLOYED" ]; then deploy_page && DEPLOYED="$HEAD"; fi
    sleep 15
  done
) &

# Serve with no-cache headers so the browser always picks up the freshest build
# on a normal reload (no hard refresh needed). Static asset names are content-
# hashed, so revalidating index.html is enough to pull the new bundle.
exec "$PY" -c '
import http.server, functools, sys
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", 7333), functools.partial(NoCache, directory=sys.argv[1])).serve_forever()
' "$SERVE"
