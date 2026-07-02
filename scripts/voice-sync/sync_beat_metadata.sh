#!/usr/bin/env bash
# One-click sheet -> builder sync for the onboarding beat metadata.
#
# Regenerates src/components/flow-designer/beatMetadata.ts from the Master Sheet
# (Beats Context + Beat Elements tabs), and if it changed, commits JUST that file
# and pushes the current branch. Safe to run anytime: no change = no commit.
#
# Trigger:  npm run beats:sync   (or: bash scripts/voice-sync/sync_beat_metadata.sh)
#
# Env (both have sensible defaults for this repo):
#   GOOGLE_SHEET_ID                 default: the App Master Sheet
#   GOOGLE_APPLICATION_CREDENTIALS  default: ~/.config/guided-growth/sheet-writer.json
#                                   (falls back to the lib's project-root service-account.json)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

OUT="src/components/flow-designer/beatMetadata.ts"
export GOOGLE_SHEET_ID="${GOOGLE_SHEET_ID:-1iNEdUm5vqmjk3YGEF1uMwfurcvgVRHykWUeBGHDBqcw}"

# Default the SA to Yair's local sheet-writer if the caller didn't set one and the
# lib's fallback (project-root service-account.json) isn't present.
if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ ! -f "$REPO_ROOT/service-account.json" ]; then
  DEFAULT_SA="$HOME/.config/guided-growth/sheet-writer.json"
  [ -f "$DEFAULT_SA" ] && export GOOGLE_APPLICATION_CREDENTIALS="$DEFAULT_SA"
fi

echo "[beats:sync] regenerating $OUT from the sheet..."
python3 scripts/voice-sync/gen_beat_metadata.py

if git diff --quiet -- "$OUT"; then
  echo "[beats:sync] no change. Builder already matches the sheet."
  exit 0
fi

echo "[beats:sync] change detected, committing + pushing..."
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git add "$OUT"
git commit -q -m "chore(flow-builder): sync beat metadata from Beats Context sheet

Regenerated beatMetadata.ts from the Master Sheet (one-click beats:sync).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
# Land on top of any remote moves before pushing.
git pull --rebase --quiet origin "$BRANCH" || true
git push origin "$BRANCH"
echo "[beats:sync] done. Pushed $OUT to origin/$BRANCH."
