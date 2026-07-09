#!/usr/bin/env python3
"""Pull the onboarding beat metadata from the Master Sheet into the flow builder.

Reads the "Beats Context" tab (beat-level: opener, flags) and the "Beat Elements"
tab (per-element micro-lines), and emits a committed TS map
(src/components/flow-designer/beatMetadata.ts) keyed by screen_id. The builder merges
this into each beat's `meta` on hydrate (withBeatMeta), the same way voiceScriptsAudio.ts
feeds mp3Assets. Re-run to refresh after the beats session edits the sheet.

Only live beats are emitted: rows whose Engine column is non-empty. Deprecated beats
(BEGINNER-05/06, ADVANCED-02/04, ADV-CUSTOM, ADVANCED-05) have blank Engine and are skipped.
The Engine column is still read to decide liveness, but its VALUE (and Scripted?,
Allowed Tools, Expected User Response) are no longer emitted into beatMetadata.ts:
those four are behavioral facts beatsSource.ts (the render, "THE ONE SOURCE") already
owns per beat, and FlowBuilder.tsx now reads them from there instead (see
withRenderFacts in FlowBuilder.tsx and gg-spec/docs/whole-system-onboarding-qa-2026-07-10.md
finding B5). Keeping a second Sheet-synced copy of those fields here let them
silently diverge from the render's. Emitting only the fields the render doesn't
model (spokenContent, variable, openerMode, openerShowsAsBubble, perElement) closes
that gap: this file can no longer disagree with beatsSource.ts on engine, mode,
tools, or expected response, because it no longer states them.

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

        # NOTE: Engine, Scripted?, Allowed Tools, and Expected User Response are
        # read above only to decide liveness / opener suppression; their VALUES
        # are deliberately not emitted. beatsSource.ts (the render) already owns
        # voiceEngine/voiceMode/allowedTools/expectedResponse per beat, and
        # FlowBuilder.tsx reads them from there (withRenderFacts), not from this
        # file. Emitting them here too let this file silently disagree with the
        # render (whole-system-onboarding-qa-2026-07-10.md, finding B5).
        meta: dict = {}

        # Opener: suppressed for Option A (control lines lead), kept otherwise.
        opener = "" if option_a else clean(r.get(C_OPENER) or "")
        if opener:
            meta["spokenContent"] = opener
        if option_a:
            meta["openerMode"] = "A"
        elif option_b:
            meta["openerMode"] = "B"

        if truthy_yes(r.get(C_VARIABLE) or ""):
            meta["variable"] = True

        # openerShowsAsBubble: Option A never, Option B always, else parse the text.
        meta["openerShowsAsBubble"] = False if option_a else (True if option_b else truthy_yes(bubble_text))

        if sid in elements:
            meta["perElement"] = elements[sid]

        beats[sid] = meta

    lines = [
        '// GENERATED from the Master Sheet "Beats Context" + "Beat Elements" tabs, for',
        "// fields the render (beatsSource.ts) does not yet model at this granularity.",
        "// Regenerate: python3 scripts/voice-sync/gen_beat_metadata.py",
        "//",
        "// This file used to also carry voiceEngine, voiceMode, allowedTools, and",
        "// expectedResponse. Those are BEHAVIORAL facts that beatsSource.ts (the render,",
        '// "THE ONE SOURCE") already owns per beat (BeatEntry.voiceEngine/voiceMode/',
        "// allowedTools/expectedResponse, looked up via BEAT_BY_SCREEN_ID). A live audit",
        "// (gg-spec/docs/whole-system-onboarding-qa-2026-07-10.md, finding B5) found this",
        "// file's Sheet-synced copies of those fields could silently diverge from the",
        "// render's, since no check compared them. FlowBuilder.tsx (withBeatMeta) now",
        "// reads those four fields directly from beatsSource.ts instead of from this",
        "// file, so they can no longer be a second source: see withRenderFacts in",
        "// FlowBuilder.tsx. gen_beat_metadata.py no longer emits them (2026-07-10).",
        "//",
        "// What's left here is authoring content the render does not carry at all: the",
        "// FlowBuilder tool's per-instance opener seed text (spokenContent), the",
        "// per-form-field micro-lines (perElement, at finer grain than beatsSource's",
        "// script[]), and two presentation flags (openerMode, openerShowsAsBubble) with",
        "// no beatsSource equivalent. Per-onboarding-beat authoring metadata, keyed by",
        "// screen_id. Merged into each beat's meta on hydrate (withBeatMeta). Wording is",
        "// provisional; wire against the flags, elementIds, and order. showsAsBubble",
        "// false = spoken, component carries the words (no chat bubble). openerMode A =",
        "// no framing opener (control lines lead); B = keep the framing opener then the",
        "// control lines.",
        "//",
        "// scripts/beat-metadata-reconcile-check.mjs (wired into check:beats) fails if",
        "// this file's screen_ids drift from beatsSource.ts's, or if a retired",
        "// behavioral field listed above reappears here.",
        "export interface BeatElementLine {",
        "  readonly elementId: string;",
        "  readonly line: string;",
        "  readonly order: number;",
        "  readonly showsAsBubble: boolean;",
        "}",
        "export interface BeatContextMeta {",
        "  readonly spokenContent?: string;",
        "  readonly variable?: boolean;",
        "  readonly openerMode?: 'A' | 'B';",
        "  readonly openerShowsAsBubble?: boolean;",
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
