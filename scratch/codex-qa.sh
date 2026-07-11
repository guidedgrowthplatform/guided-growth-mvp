#!/bin/zsh
# Direct Codex QA channel (no human session needed).
# Codex CLI is bundled in the ChatGPT app; the ~/.local/bin/codex symlink is stale.
# Auth via ~/.codex/auth.json (Yair ChatGPT sign-in). Model = gpt-5.6-terra, high effort.
#
# Usage:
#   codex-qa.sh <workdir> < prompt.txt
#   codex-qa.sh <workdir> <<'PROMPT' ... PROMPT
# Prompt is read from stdin. Verdict is printed to stdout; the prompt should also
# instruct Codex to write a verdict doc so completion is detectable out-of-band.

CODEX=/Applications/ChatGPT.app/Contents/Resources/codex
WORKDIR="${1:?usage: codex-qa.sh <workdir> < prompt}"

exec "$CODEX" exec \
  -m gpt-5.6-terra \
  -c model_reasoning_effort="high" \
  --dangerously-bypass-approvals-and-sandbox \
  -C "$WORKDIR" \
  --skip-git-repo-check
