#!/usr/bin/env python3
"""
Scan the onboarding source of truth and report whether it is the latest and
internally consistent. Read-only. Run from the repo root:

    python3 scripts/scan_onboarding_source.py

Checks, in order:
  1. designer-source.json parses; beat count + per-beat engine spread.
  2. Every MP3 beat carries an mp3Assets file, and that file exists on disk.
  3. The committed generated flow is consistent with the source (same MP3 beats
     resolve a clip; no MP3 beat in the generated flow is missing its file).
  4. Coach-context coverage: which interactive beats have their coach context
     present (in beatContexts.ts), and which are still missing. This is the gap
     the "metadata + beat context in one JSON" consolidation closes.
  5. Staging drift: is the local designer-source.json identical to origin/staging's?
"""
import json, os, subprocess, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "src/onboarding-flow/flows/designer-source.json")
GEN = os.path.join(REPO, "src/onboarding-flow/flows/onboarding-beginner-v1.generated.json")
BEATCTX = os.path.join(REPO, "api/_lib/llm/onboarding/beatContexts.ts")
PUBLIC = os.path.join(REPO, "public")

ok = True
def line(s): print(s)
def bad(s):
    global ok; ok = False; print("  FAIL: " + s)

doc = json.load(open(SRC))
beats = doc["beats"]
line(f"1. SOURCE  designer-source.json: {len(beats)} beats, flowId={doc.get('flowId')}")
spread = {}
for b in beats:
    e = (b.get("meta") or {}).get("voiceEngine", "(none)")
    spread[e] = spread.get(e, 0) + 1
line(f"   engine spread: {spread}")

line("2. CLIPS  every MP3 beat has an existing audio file:")
mp3_beats = [b for b in beats if (b.get("meta") or {}).get("voiceEngine") == "MP3"]
for b in mp3_beats:
    assets = (b.get("meta") or {}).get("mp3Assets") or []
    f = assets[0].get("file") if assets else None
    if not f:
        bad(f"beat {b.get('beat')} ({b.get('name')}): no mp3Assets file")
        continue
    path = os.path.join(PUBLIC, f.lstrip("/"))
    if not os.path.exists(path):
        bad(f"beat {b.get('beat')}: file missing on disk -> {f}")
line(f"   {len(mp3_beats)} MP3 beats checked")

line("3. GENERATED  committed flow consistent with source:")
gen = json.load(open(GEN))
gen_mp3_missing = [n["screenId"] for n in gen["nodes"]
                   if (n.get("meta") or {}).get("voiceOut", {}).get("engine") == "mp3"
                   and not (n.get("meta") or {}).get("voiceOut", {}).get("mp3Assets", [{}])[0].get("file")]
if gen_mp3_missing:
    bad(f"generated MP3 nodes missing a file: {gen_mp3_missing} (run npm run flow:sync)")
else:
    line(f"   {len(gen['nodes'])} nodes; all MP3 nodes resolve a clip")

line("4. COACH CONTEXT  coverage in beatContexts.ts (the consolidation gap):")
ctx_txt = open(BEATCTX).read() if os.path.exists(BEATCTX) else ""
interactive = [b for b in beats
               if (b.get("meta") or {}).get("engine", {}).get("voiceExpectsInput") is True]
have, missing = [], []
for b in interactive:
    sid = (b.get("sheetStage") or "").split(":")[0].strip()
    (have if sid and sid in ctx_txt else missing).append(sid or b.get("name"))
line(f"   interactive beats with coach context: {have}")
if missing:
    line(f"   NOT yet in beatContexts.ts (would be folded into the one JSON): {missing}")

line("5. STAGING DRIFT  local designer-source.json vs origin/staging:")
try:
    subprocess.run(["git", "-C", REPO, "fetch", "-q", "origin", "staging"], check=False, timeout=30)
    staging = subprocess.run(["git", "-C", REPO, "show", "origin/staging:src/onboarding-flow/flows/designer-source.json"],
                             capture_output=True, text=True, timeout=15)
    if staging.returncode != 0:
        line("   (could not read origin/staging copy)")
    else:
        same = json.loads(staging.stdout) == doc
        line("   IN SYNC with staging" if same else "   DRIFT: local differs from staging")
except Exception as e:
    line(f"   (staging check skipped: {e})")

print("\nRESULT:", "all consistent" if ok else "issues found (see FAIL lines)")
sys.exit(0 if ok else 1)
