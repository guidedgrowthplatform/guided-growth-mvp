#!/usr/bin/env bash
# Push the live conductor status to the mission-control dashboard.
#
# Usage:
#   ./push-status.sh                       # pushes conductor-status.json from this folder
#   ./push-status.sh /path/to/other.json   # pushes a different file
#
# Dashboard:   https://guidedgrowthos.com/internal/conductor
# Status JSON: https://guidedgrowthos.com/conductor-status  (public GET)
# The page polls the GET every 15s, so this push shows up live with no redeploy.
set -euo pipefail

FILE="${1:-$(dirname "$0")/conductor-status.json}"
SECRET_FILE="$HOME/.config/guided-growth/cron-worker-shared-secret.txt"

if [ ! -f "$FILE" ]; then echo "status file not found: $FILE" >&2; exit 1; fi
if [ ! -f "$SECRET_FILE" ]; then echo "shared secret not found: $SECRET_FILE" >&2; exit 1; fi

# Optional: keep "updated" fresh automatically if the tool `jq` is present.
if command -v jq >/dev/null 2>&1; then
  TMP="$(mktemp)"
  jq --arg t "$(date -Iseconds)" '.updated = $t' "$FILE" > "$TMP" && mv "$TMP" "$FILE"
fi

curl -sS -X POST https://guidedgrowthos.com/conductor-status \
  -H "X-Plugin-Secret: $(cat "$SECRET_FILE")" \
  -H "Content-Type: application/json" \
  --data-binary @"$FILE"
echo
