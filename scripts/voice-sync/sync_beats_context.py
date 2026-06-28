#!/usr/bin/env python3
"""Sheet -> Supabase sync for onboarding beat contexts.

Reads the 'Beats Context' tab of the App Master Sheet (the editable source) and
upserts the onboarding rows into:
  - beat_contexts      (context + opener per beat, version + content_hash)
  - onboarding_globals (the GLOBAL row's context, id='default')

`allowedTools` is NOT synced -- it is code-owned in beatContexts.ts. Check-in
rows (Surface != 'onboarding') are skipped: they have no beat_contexts consumer.

This replaces the hand-copied inline block in seed_beat_contexts.py so the Sheet
stays the single source of truth. After running this, run sync_beat_contexts.py
(Supabase -> api/_lib/llm/onboarding/beatContexts.generated.json) to publish.

Modes:
  default          read the live Sheet via the Google service account
  --from-json FILE  read a captured snapshot instead (no Google creds needed);
                    the file is {"rows": [ {<sheet-header>: <value>}, ... ]}

Usage:
    python scripts/voice-sync/sync_beats_context.py
    python scripts/voice-sync/sync_beats_context.py --dry-run
    python scripts/voice-sync/sync_beats_context.py --from-json beats_context.snapshot.json
    python scripts/voice-sync/sync_beats_context.py --screen-id ONBOARD-BEGINNER-06

Env (from project-root .env / .env.local in dev; GH secrets in CI):
    GOOGLE_SHEET_ID                (live-Sheet mode)
    GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON  (live-Sheet mode)
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(Path(__file__).resolve().parent / ".env")

from lib.supabase_client import get_client

BEAT_TABLE = "beat_contexts"
GLOBALS_TABLE = "onboarding_globals"
TAB = "Beats Context"
BUNDLE_VERSION = 2  # mirrors BEAT_CONTEXT_VERSION in beatContexts.ts

COL_ID = "Screen ID"
COL_CONTEXT = "Beat Context"
COL_OPENER = "Opener (verbatim, spoken)"
COL_SURFACE = "Surface"

# Opener cell values that mean "no scripted opener".
_NO_OPENER = {"", "(none)", "(none, silent)", "(n/a)", "n/a"}


def fnv1a(text: str) -> str:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "08x")


def content_hash(context: str, opener: str | None) -> str:
    return fnv1a(f"{context}\n{opener or ''}")


def norm_opener(raw: str | None) -> str | None:
    s = (raw or "").strip()
    return None if s.lower() in _NO_OPENER else s


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--dry-run", action="store_true",
                   help="read source + compute diff, skip all DB writes")
    p.add_argument("--screen-id", metavar="ID", help="process only this Screen ID")
    p.add_argument("--from-json", metavar="FILE",
                   help="read rows from a JSON snapshot instead of the live Sheet")
    return p.parse_args()


def load_rows(args: argparse.Namespace) -> list[dict]:
    if args.from_json:
        path = Path(args.from_json)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent / path
        data = json.loads(path.read_text(encoding="utf-8"))
        return data["rows"]
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    if not sheet_id:
        print("ERROR: GOOGLE_SHEET_ID not set (or use --from-json)", file=sys.stderr)
        sys.exit(1)
    from lib.sheets import get_sheet_rows
    return get_sheet_rows(sheet_id, TAB)


def main() -> int:
    args = parse_args()

    if not args.dry_run:
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set", file=sys.stderr)
            return 1

    rows = [r for r in load_rows(args) if (r.get(COL_SURFACE) or "").strip() == "onboarding"]
    beats = [r for r in rows if (r.get(COL_ID) or "").strip() != "GLOBAL"]
    globals_rows = [r for r in rows if (r.get(COL_ID) or "").strip() == "GLOBAL"]

    print(f"Source: {'snapshot ' + args.from_json if args.from_json else 'live Sheet'}")
    print(f"  {len(beats)} onboarding beats + {len(globals_rows)} global row(s)")

    sb = None if args.dry_run else get_client()
    inserted = updated = noop = 0

    for r in beats:
        screen_id = (r.get(COL_ID) or "").strip()
        if args.screen_id and screen_id != args.screen_id:
            continue
        context = (r.get(COL_CONTEXT) or "").strip()
        opener = norm_opener(r.get(COL_OPENER))
        if not context:
            print(f"  SKIP   {screen_id} (empty context)")
            continue
        chash = content_hash(context, opener)

        existing_hash: str | None = None
        existing_version = 0
        if sb is not None:
            res = sb.table(BEAT_TABLE).select("content_hash, version").eq("screen_id", screen_id).execute()
            if res.data:
                existing_hash = res.data[0]["content_hash"]
                existing_version = res.data[0]["version"]

        if existing_hash == chash:
            noop += 1
            print(f"  noop   {screen_id}")
            continue

        new_version = existing_version + 1 if existing_hash is not None else 1
        action = "UPDATE" if existing_hash is not None else "INSERT"
        print(f"  {action} {screen_id} (v{new_version})")
        if sb is not None:
            row = {"screen_id": screen_id, "context": context,
                   "version": new_version, "content_hash": chash}
            row["opener"] = opener  # explicit null clears a removed opener
            sb.table(BEAT_TABLE).upsert(row, on_conflict="screen_id").execute()
        if existing_hash is not None:
            updated += 1
        else:
            inserted += 1

    if globals_rows and not args.screen_id:
        gctx = (globals_rows[0].get(COL_CONTEXT) or "").strip()
        gchash = fnv1a(gctx)
        existing_global_hash: str | None = None
        if sb is not None:
            gres = sb.table(GLOBALS_TABLE).select("global_context").eq("id", "default").execute()
            if gres.data:
                existing_global_hash = fnv1a(gres.data[0]["global_context"])
        if existing_global_hash == gchash:
            print("  noop   onboarding_globals/default")
        else:
            action = "UPDATE" if existing_global_hash is not None else "INSERT"
            print(f"  {action} onboarding_globals/default (bundle_version={BUNDLE_VERSION})")
            if sb is not None:
                sb.table(GLOBALS_TABLE).upsert(
                    {"id": "default", "global_context": gctx, "bundle_version": BUNDLE_VERSION},
                    on_conflict="id",
                ).execute()

    print(f"\nDone: {inserted} inserted, {updated} updated, {noop} unchanged.")
    if args.dry_run:
        print("[dry-run] no DB writes performed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
