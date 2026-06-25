#!/usr/bin/env python3
"""Pull the check-in MP3 map from the Master Sheet "Voice Scripts" tab into the flow builder.

Reads the `mp3_en` URL column + `text_en`, groups by `stage`, and emits a committed TS map
(src/components/flow-designer/voiceScriptsAudio.ts) of {file, text} per stage. The builder
auto-fills each beat's `mp3Assets` metadata from this map by stage. Re-run to refresh.

Env: GOOGLE_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_SERVICE_ACCOUNT_JSON).
Tab via VOICE_SCRIPTS_TAB (default "Voice Scripts").
"""
from __future__ import annotations
import json, os, sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sheets import get_sheet_header, get_sheet_rows  # noqa: E402

TAB = os.environ.get("VOICE_SCRIPTS_TAB") or "Voice Scripts"
OUT = PROJECT_ROOT / "src/components/flow-designer/voiceScriptsAudio.ts"


def main() -> int:
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set", file=sys.stderr)
        return 1
    header = get_sheet_header(sheet_id, TAB)
    for h in ("stage", "n", "mp3_en", "text_en"):
        if h not in header:
            print(f"ERROR: tab {TAB!r} missing header {h!r}", file=sys.stderr)
            return 1
    grouped: dict[str, list[tuple[int, str, str]]] = {}
    for r in get_sheet_rows(sheet_id, TAB):
        stage = (r.get("stage") or "").strip()
        url = (r.get("mp3_en") or "").strip()
        text = (r.get("text_en") or "").strip()
        n_raw = (r.get("n") or "").strip()
        if not stage or not url:
            continue
        try:
            n = int(n_raw)
        except ValueError:
            continue
        grouped.setdefault(stage, []).append((n, url, text))
    out = {st: [{"file": u, "text": t} for _, u, t in sorted(v)] for st, v in grouped.items()}
    lines = [
        '// GENERATED from the Master Sheet "Voice Scripts" tab (mp3_en + text_en).',
        "// Regenerate: python3 scripts/voice-sync/gen_voice_scripts_audio.py",
        "// Each Voice Scripts stage -> its rotation of pre-rendered clips {file, text}.",
        "export interface VoiceClip {",
        "  readonly file: string;",
        "  readonly text: string;",
        "}",
        "export const VOICE_SCRIPTS_AUDIO: Record<string, readonly VoiceClip[]> = {",
    ]
    for st in sorted(out):
        lines.append(f"  {json.dumps(st)}: [")
        for c in out[st]:
            lines.append(f"    {{ file: {json.dumps(c['file'])}, text: {json.dumps(c['text'])} }},")
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT.name}: {len(out)} stages, {sum(len(v) for v in out.values())} clips", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
