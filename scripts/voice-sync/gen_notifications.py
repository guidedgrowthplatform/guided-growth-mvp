#!/usr/bin/env python3
"""Generate the committed notification-copy artifact from the Master Sheet.

Reads the voice-script notification rows (morning_notification / evening_notification)
and emits packages/shared/src/generated/notification_copy.ts — the REMINDER_VARIANTS
rotation pool the app reads. English-only for now (title_en / text_en); Hebrew columns
and `status` are ignored. No Supabase: this is a build-time artifact (icon-bundle model).

Usage:
    python scripts/voice-sync/gen_notifications.py
    python scripts/voice-sync/gen_notifications.py --dry-run     # print, don't write
    python scripts/voice-sync/gen_notifications.py --no-format   # skip the prettier pass

Env (loaded from project-root .env / .env.local in dev; from GH secrets in CI):
    GOOGLE_SHEET_ID
    NOTIFICATION_TAB              (tab holding the *_notification rows; default "Notifications")
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

# CONFIRM: the Master Sheet tab holding the morning_notification / evening_notification rows.
TAB = os.environ.get("NOTIFICATION_TAB", "Notifications")
OUTPUT_PATH = PROJECT_ROOT / "packages/shared/src/generated/notification_copy.ts"

REQUIRED_HEADERS = ("surface", "stage", "n", "title_en", "text_en")
STAGE_TO_KEY = {
    "morning_notification": "morning_checkin",
    "evening_notification": "evening_checkin",
}
KEY_ORDER = ("morning_checkin", "evening_checkin")

BANNER = (
    "// GENERATED — do not edit by hand.\n"
    f'// Source: Master Sheet "{TAB}" tab (morning_notification / evening_notification rows).\n'
    "// Regenerate: npm run notifications:bundle"
)


def build_variants(rows: list[dict]) -> dict[str, list[dict[str, str]]]:
    """Group notification rows by slot, ordered by `n`. Raises on a malformed tab."""
    grouped: dict[str, list[tuple[int, dict[str, str]]]] = {k: [] for k in KEY_ORDER}
    for row in rows:
        key = STAGE_TO_KEY.get((row.get("stage") or "").strip())
        if not key:
            continue
        title = (row.get("title_en") or "").strip()
        body = (row.get("text_en") or "").strip()
        n_raw = (row.get("n") or "").strip()
        if not title or not body:
            raise ValueError(f"empty title/body for {key} n={n_raw!r}")
        try:
            n = int(n_raw)
        except ValueError as exc:
            raise ValueError(f"non-integer n={n_raw!r} for {key}") from exc
        grouped[key].append((n, {"title": title, "body": body}))

    out: dict[str, list[dict[str, str]]] = {}
    for key in KEY_ORDER:
        items = sorted(grouped[key], key=lambda t: t[0])
        if not items:
            raise ValueError(f"no rows found for {key} (stage not in tab?)")
        if [n for n, _ in items] != list(range(1, len(items) + 1)):
            raise ValueError(f"{key} n values are not contiguous from 1: {[n for n, _ in items]}")
        out[key] = [v for _, v in items]
    return out


def render_ts(variants: dict[str, list[dict[str, str]]]) -> str:
    """Render valid TS (double-quoted); a prettier pass normalizes quotes + wrapping."""
    lines = [
        BANNER,
        "",
        "export const REMINDER_VARIANTS: Record<",
        "  'morning_checkin' | 'evening_checkin',",
        "  ReadonlyArray<{ title: string; body: string }>",
        "> = {",
    ]
    for key in KEY_ORDER:
        lines.append(f"  {key}: [")
        for v in variants[key]:
            t = json.dumps(v["title"], ensure_ascii=False)
            b = json.dumps(v["body"], ensure_ascii=False)
            lines.append(f"    {{ title: {t}, body: {b} }},")
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
    ts = render_ts(variants)

    if args.dry_run:
        print(ts)
        n = {k: len(v) for k, v in variants.items()}
        print(f"\n[dry-run] {n} variants — not written", file=sys.stderr)
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(ts, encoding="utf-8")
    if not args.no_format:
        # match repo prettier style so the committed file is byte-stable across runs
        subprocess.run(["npx", "prettier", "--write", str(OUTPUT_PATH)], check=True, cwd=PROJECT_ROOT)
    print(f"wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}", file=sys.stderr)
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--dry-run", action="store_true", help="print the artifact, write nothing")
    p.add_argument("--no-format", action="store_true", help="skip the prettier pass")
    return p.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
