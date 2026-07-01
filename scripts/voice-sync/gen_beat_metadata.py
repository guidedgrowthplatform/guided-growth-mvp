#!/usr/bin/env python3
"""Pull the onboarding beat metadata from the Master Sheet into the flow builder.

Reads the "Beats Context" tab (beat-level: engine, mode, opener, tools, flags) and the
"Beat Elements" tab (per-element micro-lines), and emits a committed TS map
(src/components/flow-designer/beatMetadata.ts) keyed by screen_id. The builder merges
this into each beat's `meta` on hydrate (withBeatMeta), the same way voiceScriptsAudio.ts
feeds mp3Assets. Re-run to refresh after the beats session edits the sheet.

Only live beats are emitted: rows whose Engine column is non-empty. Deprecated beats
(BEGINNER-05/06, ADVANCED-02/04, ADV-CUSTOM, ADVANCED-05) have blank Engine and are skipped.

Opener handling: the "Shows as bubble?" text encodes Option A / Option B. Option A beats
(scheduler beats whose per-element control lines lead) get NO framing opener even though
column E may still hold a stale one; Option B keeps the framing opener.

Env: GOOGLE_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_SERVICE_ACCOUNT_JSON).
Tabs via BEATS_CONTEXT_TAB (default "Beats Context") and BEAT_ELEMENTS_TAB (default "Beat Elements").
"""
from __future__ import annotations
import json, os, sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sheets import get_sheet_header, get_sheet_rows  # noqa: E402

CONTEXT_TAB = os.environ.get("BEATS_CONTEXT_TAB") or "Beats Context"
ELEMENTS_TAB = os.environ.get("BEAT_ELEMENTS_TAB") or "Beat Elements"
OUT = PROJECT_ROOT / "src/components/flow-designer/beatMetadata.ts"

# Sheet Engine -> builder voiceEngine enum (Vapi | Cartesia | MP3 | None).
ENGINE_MAP = {"silent": "None", "mp3": "MP3", "cartesia": "Cartesia", "vapi": "Vapi", "none": "None"}

# Beats Context columns we consume (by header name).
C_SCREEN = "Screen ID"
C_OPENER = "Opener (verbatim, spoken)"
C_TOOLS = "Allowed Tools"
C_SURFACE = "Surface"
C_ENGINE = "Engine"
C_SCRIPTED = "Scripted?"
C_VARIABLE = "Variable?"
C_BUBBLE = "Shows as bubble?"
C_EXPECTED = "Expected User Response"


def truthy_yes(v: str) -> bool:
    return v.strip().lower().startswith("yes")


def clean(v: str) -> str:
    v = (v or "").strip()
    # Treat sheet placeholders as empty.
    if v.lower() in ("(none)", "(none, silent)", "n/a", "(n/a)", ""):
        return ""
    return v


def main() -> int:
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set", file=sys.stderr)
        return 1

    ctx_header = get_sheet_header(sheet_id, CONTEXT_TAB)
    for h in (C_SCREEN, C_ENGINE, C_SURFACE):
        if h not in ctx_header:
            print(f"ERROR: tab {CONTEXT_TAB!r} missing header {h!r}", file=sys.stderr)
            return 1

    # Per-element lines grouped by screen_id.
    elements: dict[str, list[dict]] = {}
    for r in get_sheet_rows(sheet_id, ELEMENTS_TAB):
        sid = (r.get("Beat Screen ID") or "").strip()
        eid = (r.get("elementId") or "").strip()
        if not sid or not eid:
            continue
        try:
            order = int((r.get("order") or "0").strip())
        except ValueError:
            order = 0
        elements.setdefault(sid, []).append({
            "elementId": eid,
            "line": (r.get("line") or "").strip(),
            "order": order,
            "showsAsBubble": truthy_yes(r.get("Shows as bubble?") or ""),
        })
    for sid in elements:
        elements[sid].sort(key=lambda e: e["order"])

    beats: dict[str, dict] = {}
    for r in get_sheet_rows(sheet_id, CONTEXT_TAB):
        sid = (r.get(C_SCREEN) or "").strip()
        surface = (r.get(C_SURFACE) or "").strip().lower()
        engine_raw = (r.get(C_ENGINE) or "").strip()
        # Live onboarding beats only: onboarding surface + a real Engine value.
        if surface != "onboarding" or not engine_raw:
            continue

        bubble_text = (r.get(C_BUBBLE) or "").strip()
        option_a = "option a" in bubble_text.lower()
        option_b = "option b" in bubble_text.lower()

        meta: dict = {"voiceEngine": ENGINE_MAP.get(engine_raw.lower(), engine_raw)}

        if (r.get(C_SCRIPTED) or "").strip().lower() == "scripted":
            meta["voiceMode"] = "Verbatim"

        # Opener: suppressed for Option A (control lines lead), kept otherwise.
        opener = "" if option_a else clean(r.get(C_OPENER) or "")
        if opener:
            meta["spokenContent"] = opener
        if option_a:
            meta["openerMode"] = "A"
        elif option_b:
            meta["openerMode"] = "B"

        tools = clean(r.get(C_TOOLS) or "")
        if tools:
            meta["allowedTools"] = tools

        if truthy_yes(r.get(C_VARIABLE) or ""):
            meta["variable"] = True

        # openerShowsAsBubble: Option A never, Option B always, else parse the text.
        meta["openerShowsAsBubble"] = False if option_a else (True if option_b else truthy_yes(bubble_text))

        expected = clean(r.get(C_EXPECTED) or "")
        if expected:
            meta["expectedResponse"] = expected

        if sid in elements:
            meta["perElement"] = elements[sid]

        beats[sid] = meta

    lines = [
        '// GENERATED from the Master Sheet "Beats Context" + "Beat Elements" tabs.',
        "// Regenerate: python3 scripts/voice-sync/gen_beat_metadata.py",
        "// Per-onboarding-beat authoring metadata, keyed by screen_id. Merged into each",
        "// beat's meta on hydrate (withBeatMeta). Wording is provisional; wire against the",
        "// engine, flags, elementIds, and order. showsAsBubble false = spoken, component",
        "// carries the words (no chat bubble). openerMode A = no framing opener (control",
        "// lines lead); B = keep the framing opener then the control lines.",
        "export interface BeatElementLine {",
        "  readonly elementId: string;",
        "  readonly line: string;",
        "  readonly order: number;",
        "  readonly showsAsBubble: boolean;",
        "}",
        "export interface BeatContextMeta {",
        "  readonly voiceEngine?: string;",
        "  readonly voiceMode?: string;",
        "  readonly spokenContent?: string;",
        "  readonly allowedTools?: string;",
        "  readonly variable?: boolean;",
        "  readonly openerMode?: 'A' | 'B';",
        "  readonly openerShowsAsBubble?: boolean;",
        "  readonly expectedResponse?: string;",
        "  readonly perElement?: readonly BeatElementLine[];",
        "}",
        "export const BEAT_METADATA: Record<string, BeatContextMeta> = {",
    ]
    for sid in sorted(beats):
        lines.append(f"  {json.dumps(sid)}: {json.dumps(beats[sid])},")
    lines.append("};")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    n_el = sum(1 for b in beats.values() if b.get("perElement"))
    print(f"wrote {OUT.name}: {len(beats)} beats, {n_el} with per-element lines", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
