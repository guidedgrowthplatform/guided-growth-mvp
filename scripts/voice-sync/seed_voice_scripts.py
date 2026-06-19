#!/usr/bin/env python3
"""Seed `voice_scripts` from the "Voice Scripts" tab of the App Master Sheet.

Sibling of seed_contexts.py. Idempotent: hashes each row's source, only upserts
when the hash differs from what is already in Supabase. One row per variation,
keyed by (stage, n). All language/gender columns (title_*/text_*) are stored
together in a JSONB `lines` column, so adding a language is a sheet column, not
a migration.

Usage:
    python scripts/voice-sync/seed_voice_scripts.py
    python scripts/voice-sync/seed_voice_scripts.py --dry-run
    python scripts/voice-sync/seed_voice_scripts.py --prune

Env: same as seed_contexts.py (GOOGLE_SHEET_ID, SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(Path(__file__).resolve().parent / ".env")

from lib.hashing import canonical_hash
from lib.sheets import get_sheet_header, get_sheet_rows
from lib.supabase_client import get_client

TABLE = "voice_scripts"
TAB = "Voice Scripts"
REQUIRED_HEADERS = ("surface", "stage", "n", "text_en", "spoken", "status")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--dry-run", action="store_true",
                   help="read sheet + compute diff, skip all DB writes")
    p.add_argument("--prune", action="store_true",
                   help="hard-delete voice_scripts rows whose (stage, n) is no longer in the sheet")
    return p.parse_args()


def _truthy(val) -> bool:
    return str(val).strip().lower() in ("true", "1", "yes")


def extract_lines(row: dict) -> dict:
    """All non-empty title_* / text_* columns, keyed by column name."""
    return {
        k: str(row[k]).strip()
        for k in row
        if (k.startswith("title_") or k.startswith("text_")) and str(row.get(k)).strip()
    }


def main() -> int:
    args = parse_args()

    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set", file=sys.stderr)
        return 1

    header = get_sheet_header(sheet_id, TAB)
    missing = [h for h in REQUIRED_HEADERS if h not in header]
    if missing:
        print(f"FATAL: '{TAB}' tab missing required columns: {missing}", file=sys.stderr)
        return 2

    print(f"Fetching {TAB!r} from sheet {sheet_id[:12]}...", flush=True)
    raw_rows = get_sheet_rows(sheet_id, TAB)
    print(f"  {len(raw_rows)} rows total")

    seen_keys: set[tuple[str, int]] = set()
    seedable: list[dict] = []
    skipped: list[str] = []

    for row in raw_rows:
        stage = (row.get("stage") or "").strip()
        n_raw = (row.get("n") or "").strip()
        if not stage or not n_raw:
            continue
        try:
            n = int(n_raw)
        except ValueError:
            skipped.append(f"{stage}/{n_raw}: n is not an integer")
            continue
        key = (stage, n)
        if key in seen_keys:
            skipped.append(f"{stage}/{n}: duplicate (stage, n), keeping first")
            continue
        lines = extract_lines(row)
        if not lines:
            skipped.append(f"{stage}/{n}: no title_/text_ content")
            continue
        seen_keys.add(key)
        seedable.append({
            "stage":   stage,
            "n":       n,
            "surface": (row.get("surface") or "").strip(),
            "spoken":  _truthy(row.get("spoken")),
            "status":  (row.get("status") or "Draft").strip(),
            "notes":   (row.get("notes") or "").strip(),
            "lines":   lines,
        })

    for s in skipped:
        print(f"  WARN skip {s}", file=sys.stderr)
    print(f"  {len(seedable)} variations seedable")

    if args.dry_run:
        print("\n[dry-run] not connecting to Supabase. Computing diff only.")
    sb = None if args.dry_run else get_client()

    inserted = updated = noop = 0
    for rec in seedable:
        source = {k: rec[k] for k in ("surface", "stage", "n", "spoken", "status", "notes", "lines")}
        content_hash = canonical_hash(source)

        existing_hash: str | None = None
        existing_version: int = 0
        if sb is not None:
            res = (sb.table(TABLE).select("content_hash, version")
                   .eq("stage", rec["stage"]).eq("n", rec["n"]).execute())
            if res.data:
                existing_hash = res.data[0]["content_hash"]
                existing_version = res.data[0]["version"]

        if existing_hash == content_hash:
            noop += 1
            continue

        new_version = existing_version + 1 if existing_hash is not None else 1
        action = "UPDATE" if existing_hash is not None else "INSERT"
        print(f"  {action} {rec['stage']}/{rec['n']} (v{new_version})")

        if sb is not None:
            sb.table(TABLE).upsert({
                "stage":        rec["stage"],
                "n":            rec["n"],
                "surface":      rec["surface"],
                "spoken":       rec["spoken"],
                "status":       rec["status"],
                "notes":        rec["notes"],
                "lines":        rec["lines"],
                "content_hash": content_hash,
                "version":      new_version,
            }, on_conflict="stage,n").execute()

        if existing_hash is not None:
            updated += 1
        else:
            inserted += 1

    pruned = 0
    if args.prune and sb is not None:
        print("\n[prune] checking for orphan rows...")
        all_db = sb.table(TABLE).select("stage, n").execute()
        live = {(r["stage"], r["n"]) for r in (all_db.data or [])}
        for stage, n in sorted(live - seen_keys):
            print(f"  DELETE {stage}/{n}")
            sb.table(TABLE).delete().eq("stage", stage).eq("n", n).execute()
            pruned += 1

    print(
        f"\nrows_scanned={len(raw_rows)} seedable={len(seedable)} "
        f"inserted={inserted} updated={updated} noop={noop} pruned={pruned} skipped={len(skipped)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
