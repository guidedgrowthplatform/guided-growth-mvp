#!/usr/bin/env python3
"""Generate the committed check-in TTS-line artifact from the Master Sheet.

Reads the in-session check-in stages from the voice-script tab (morning_greeting,
morning_state_prompt, evening_*, reflection_*, are_you_done, acknowledgment, ...)
and emits two committed artifacts from the same data:
  - checkin_scripts.ts    — CHECKIN_SCRIPT_VARIANTS, what @gg/shared imports (must be .ts:
                            the @gg/shared runtime lane can't resolve a .json from dist/)
  - checkin_scripts.json  — data-only sibling for external tooling (the app never reads it)

The *_notification rows in the same tab belong to gen_notifications.py and are skipped
here. English-only for now (text_en); Hebrew columns are ignored.
No Supabase: build-time artifact (same model as gen_notifications.py).

Usage:
    python scripts/voice-sync/gen_checkin_scripts.py
    python scripts/voice-sync/gen_checkin_scripts.py --dry-run     # print, don't write
    python scripts/voice-sync/gen_checkin_scripts.py --no-format   # skip the prettier pass

Env (loaded from project-root .env / .env.local in dev; from GH secrets in CI):
    GOOGLE_SHEET_ID
    CHECKIN_TAB                  (tab holding the check-in script rows; default "Voice Scripts")
    GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON  (see lib/sheets.py)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

TAB = os.environ.get("CHECKIN_TAB") or "Voice Scripts"
OUTPUT_PATH = PROJECT_ROOT / "packages/shared/src/generated/checkin_scripts.ts"
OUTPUT_JSON = PROJECT_ROOT / "packages/shared/src/generated/checkin_scripts.json"

REQUIRED_HEADERS = ("stage", "n", "text_en")

# The in-session check-in stages this artifact owns, in canonical order
# (must stay a superset-free match of CheckinStageKey in
# packages/shared/src/checkin/scriptVariations.ts).
KNOWN_STAGES = (
    "morning_greeting",
    "morning_state_prompt",
    "morning_wrap",
    "evening_greeting_habits",
    "evening_habit_prompt",
    "reflection_transition",
    "reflection_proud",
    "reflection_forgive",
    "reflection_grateful",
    "evening_wrap",
    "are_you_done",
    "acknowledgment",
)

# Rows owned by other generators (gen_notifications.py) — skipped quietly, not "unknown".
OTHER_OWNER_STAGES = {"morning_notification", "evening_notification"}

BANNER = (
    "// GENERATED — do not edit by hand.\n"
    f'// Source: Master Sheet "{TAB}" tab (check-in in-session stages).\n'
    "// Regenerate: npm run checkin:bundle"
)


def build_variants(rows: list[dict]) -> dict[str, list[str]]:
    """Group check-in rows by stage, ordered by `n`. Raises on a malformed tab."""
    grouped: dict[str, list[tuple[int, str]]] = {k: [] for k in KNOWN_STAGES}
    unknown: set[str] = set()
    for r in rows:
        stage = (r.get("stage") or "").strip()
        if not stage or stage in OTHER_OWNER_STAGES:
            continue
        if stage not in grouped:
            unknown.add(stage)
            continue
        text = (r.get("text_en") or "").strip()
        n_raw = (r.get("n") or "").strip()
        if not text:
            raise ValueError(f"empty text_en for {stage} n={n_raw!r}")
        try:
            n = int(n_raw)
        except ValueError as exc:
            raise ValueError(f"non-integer n={n_raw!r} for {stage}") from exc
        grouped[stage].append((n, text))

    if unknown:
        print(f"[warn] skipped unknown stage(s): {sorted(unknown)}", file=sys.stderr)

    out: dict[str, list[str]] = {}
    for stage in KNOWN_STAGES:
        items = sorted(grouped[stage], key=lambda t: t[0])
        ns = [n for n, _ in items]
        if not items:
            # A known stage missing from the sheet is drift, but not fatal: the app
            # overlay falls back to its hand-authored line. Warn and skip.
            print(f"[warn] no rows for known stage {stage!r} — app will use its fallback line",
                  file=sys.stderr)
            continue
        if len(set(ns)) != len(ns):
            raise ValueError(f"{stage} has duplicate n values: {ns}")
        if ns != list(range(1, len(ns) + 1)):
            raise ValueError(f"{stage} n values are not contiguous from 1: {ns}")
        out[stage] = [text for _, text in items]
    return out


def render_ts(variants: dict[str, list[str]]) -> str:
    """Render valid TS (double-quoted); a prettier pass normalizes quotes + wrapping."""
    lines = [
        BANNER,
        "",
        "export const CHECKIN_SCRIPT_VARIANTS: Record<string, readonly string[]> = {",
    ]
    for stage in KNOWN_STAGES:
        if stage not in variants:
            continue
        lines.append(f"  {stage}: [")
        for text in variants[stage]:
            lines.append(f"    {json.dumps(text, ensure_ascii=False)},")
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()

    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / ".env.local")
    load_dotenv(Path(__file__).resolve().parent / ".env")
    from lib.sheets import get_sheet_header, get_sheet_rows

    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set", file=sys.stderr)
        return 1

    header = get_sheet_header(sheet_id, TAB)
    missing = [h for h in REQUIRED_HEADERS if h not in header]
    if missing:
        print(f"ERROR: tab {TAB!r} missing headers: {missing}", file=sys.stderr)
        return 1

    rows = get_sheet_rows(sheet_id, TAB)
    variants = build_variants(rows)
    if not variants:
        print("ERROR: no check-in stages found in the sheet", file=sys.stderr)
        return 1
    ts = render_ts(variants)

    if args.dry_run:
        print(ts)
        counts = {k: len(v) for k, v in variants.items()}
        print(f"\n[dry-run] {counts} — not written", file=sys.stderr)
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(ts, encoding="utf-8")
    OUTPUT_JSON.write_text(json.dumps(variants, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if not args.no_format:
        subprocess.run(
            ["npx", "prettier", "--write", str(OUTPUT_PATH), str(OUTPUT_JSON)],
            check=True,
            cwd=PROJECT_ROOT,
        )
    print(f"wrote {OUTPUT_PATH.name} + {OUTPUT_JSON.name}", file=sys.stderr)
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--dry-run", action="store_true", help="print the artifact, write nothing")
    p.add_argument("--no-format", action="store_true", help="skip the prettier pass")
    return p.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
