#!/usr/bin/env python3
"""Seed `screen_contexts` from the Screens tab of the Voice Journey Sheet.

Idempotent: hashes each row's source columns, only upserts when the hash differs
from what's already in Supabase. Never auto-deletes (use --prune for that).

Usage:
    python scripts/voice-sync/seed_contexts.py
    python scripts/voice-sync/seed_contexts.py --dry-run
    python scripts/voice-sync/seed_contexts.py --screen-id ONBOARD-BEGINNER-03
    python scripts/voice-sync/seed_contexts.py --prune

Env (loaded from project-root .env / .env.local in dev; from GH secrets in CI):
    GOOGLE_SHEET_ID
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    GOOGLE_APPLICATION_CREDENTIALS (file path; what CI uses — workflow stages SA JSON to $RUNNER_TEMP/sa.json.
                                   Falls back to project-root service-account.json locally.)
    GOOGLE_SERVICE_ACCOUNT_JSON   (alternative: full JSON string. Takes priority at runtime if both are set.)
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
from lib.transform import (
    extract_source,
    format_screen_context,
    is_screen_row,
    validate_headers,
    validate_row,
)

TABLE = "screen_contexts"
TAB = "Screens"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--dry-run", action="store_true",
                   help="read sheet + compute diff, skip all DB writes")
    p.add_argument("--screen-id", metavar="ID",
                   help="process only this Screen ID (for fast iteration)")
    p.add_argument("--prune", action="store_true",
                   help="hard-delete screen_contexts rows whose Screen ID is no longer in the sheet")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set", file=sys.stderr)
        return 1

    header = get_sheet_header(sheet_id, TAB)
    missing = validate_headers(header)
    if missing:
        print(f"FATAL: sheet headers missing required columns: {missing}", file=sys.stderr)
        return 2

    print(f"Fetching {TAB!r} from sheet {sheet_id[:12]}...", flush=True)
    raw_rows = get_sheet_rows(sheet_id, TAB)
    print(f"  {len(raw_rows)} rows total")

    seen_ids: set[str] = set()
    duplicates: list[str] = []
    skipped_warnings: list[tuple[str, str]] = []
    seedable: list[dict] = []

    for row in raw_rows:
        if not is_screen_row(row):
            continue

        screen_id = (row.get("Screen ID") or "").strip()
        reason = validate_row(row)
        if reason is not None:
            label = screen_id or "(no Screen ID)"
            skipped_warnings.append((label, reason))
            continue

        if screen_id in seen_ids:
            duplicates.append(screen_id)
            continue
        seen_ids.add(screen_id)

        if args.screen_id and screen_id != args.screen_id:
            continue

        seedable.append(row)

    for label, reason in skipped_warnings:
        print(f"  WARN skip {label}: {reason}", file=sys.stderr)
    for sid in duplicates:
        print(f"  WARN duplicate Screen ID {sid}: keeping first occurrence", file=sys.stderr)

    print(f"  {len(seedable)} screens seedable"
          + (f" (filtered to {args.screen_id!r})" if args.screen_id else ""))

    if args.dry_run:
        print("\n[dry-run] not connecting to Supabase. Computing diff only.")

    sb = None if args.dry_run else get_client()

    inserted = updated = noop = 0
    for row in seedable:
        screen_id = row["Screen ID"].strip()
        source = extract_source(row)
        content_hash = canonical_hash(source)
        context_block = format_screen_context(row)

        existing_hash: str | None = None
        existing_version: int = 0
        if sb is not None:
            res = sb.table(TABLE).select("content_hash, version").eq("screen_id", screen_id).execute()
            if res.data:
                existing_hash = res.data[0]["content_hash"]
                existing_version = res.data[0]["version"]

        if existing_hash == content_hash:
            noop += 1
            continue

        new_version = existing_version + 1 if existing_hash is not None else 1
        action = "UPDATE" if existing_hash is not None else "INSERT"
        print(f"  {action} {screen_id} (v{new_version})")

        if sb is not None:
            sb.table(TABLE).upsert({
                "screen_id":     screen_id,
                "context_block": context_block,
                "content_hash":  content_hash,
                "source_row":    source,
                "version":       new_version,
            }, on_conflict="screen_id").execute()

        if existing_hash is not None:
            updated += 1
        else:
            inserted += 1

    pruned = 0
    if args.prune and sb is not None and not args.screen_id:
        print("\n[prune] checking for orphan rows...")
        all_db = sb.table(TABLE).select("screen_id").execute()
        live_ids = {r["screen_id"] for r in (all_db.data or [])}
        orphans = sorted(live_ids - seen_ids)
        for orphan in orphans:
            print(f"  DELETE {orphan}")
            sb.table(TABLE).delete().eq("screen_id", orphan).execute()
            pruned += 1

    trigger = os.environ.get("TRIGGER_SOURCE", "manual-local")
    skipped_total = len(skipped_warnings) + len(duplicates)
    print(
        f"\n**voice-sync** OK · trigger=`{trigger}` · "
        f"scanned={len(raw_rows)} seedable={len(seedable)} "
        f"inserted={inserted} updated={updated} noops={noop} "
        f"pruned={pruned} skipped={skipped_total}"
    )

    if sb is not None:
        try:
            sb.table("voice_sync_health").insert({
                "trigger_source": trigger,
                "inserts": inserted,
                "updates": updated,
                "noops": noop,
                "skipped": skipped_total,
                "pruned": pruned,
            }).execute()
        except Exception as exc:
            msg = str(exc)
            if "voice_sync_health" in msg and ("does not exist" in msg or "42P01" in msg):
                print(
                    "  voice_sync_health table not present yet — migration 018 unapplied; "
                    "skipping telemetry insert.",
                    file=sys.stderr,
                )
            else:
                print(f"  WARN voice_sync_health insert failed: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
