#!/usr/bin/env python3
"""Apply onboarding "beats" from the beats Google Sheet into the app's
screen-context bundle.

Yair designs the per-screen onboarding coaching beats in a Google Sheet (the
"beats Sheet"). This command reads that Sheet and rewrites the `context_block`
for the matching screens in `src/generated/screen_contexts.json` — the file the
app bundles and feeds to the coach.

It is deliberately branch-local: it only edits a file in the repo. Nothing here
writes to Supabase or the live app. You run it on a branch, review the diff,
test a preview build, and merge to ship. The hourly Sheet->Supabase sync that
feeds the live app reads a DIFFERENT sheet (the App Master Sheet), so this
command and that pipeline do not collide while you iterate.

Usage:
    python scripts/onboarding-beats/apply_beats.py --dry-run
    python scripts/onboarding-beats/apply_beats.py --only ONBOARD-01--FORM
    python scripts/onboarding-beats/apply_beats.py            # apply every beat

Auth:
    Reads the beats Sheet with a Google service account that has at least
    Viewer access to it. Resolution order for the credentials file:
      1. --sa <path>
      2. $GOOGLE_SERVICE_ACCOUNT
      3. ~/.config/guided-growth/service-account.json
      4. ./service-account.json  (repo root)
    The default service account is voice-sync-reader@guided-growth-voice.iam.gserviceaccount.com
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import sys
from pathlib import Path

# The beats Sheet ("Guided Growth onboarding beats"). Stage column holds
# "<SCREEN-ID>: <human label>"; Suggested column holds the beat text.
BEATS_SHEET_ID = "1UqKXKjV2FKuIdBnwl1kPftIne1ksLxBs0C5y9E2jo80"
BEATS_TAB = "Sheet1"
STAGE_COL = 0       # column A
SUGGESTED_COL = 2   # column C

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BUNDLE_PATH = PROJECT_ROOT / "src" / "generated" / "screen_contexts.json"

SA_CANDIDATES = [
    os.environ.get("GOOGLE_SERVICE_ACCOUNT"),
    str(Path.home() / ".config" / "guided-growth" / "service-account.json"),
    str(PROJECT_ROOT / "service-account.json"),
]


def canonical_hash(obj) -> str:
    """Match scripts/voice-sync/lib/hashing.py:canonical_hash."""
    payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def resolve_sa(explicit: str | None) -> str:
    for cand in [explicit, *SA_CANDIDATES]:
        if cand and Path(cand).expanduser().is_file():
            return str(Path(cand).expanduser())
    print("ERROR: no service-account.json found. Pass --sa <path> or set "
          "GOOGLE_SERVICE_ACCOUNT.", file=sys.stderr)
    sys.exit(2)


def fetch_beats(sa_path: str) -> dict[str, str]:
    """Return {screen_id: beat_text} from the beats Sheet."""
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    creds = Credentials.from_service_account_file(
        sa_path, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    service = build("sheets", "v4", credentials=creds)
    resp = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=BEATS_SHEET_ID, range=f"{BEATS_TAB}!A2:C100")
        .execute()
    )
    rows = resp.get("values", [])
    beats: dict[str, str] = {}
    for row in rows:
        stage = (row[STAGE_COL] if len(row) > STAGE_COL else "").strip()
        suggested = (row[SUGGESTED_COL] if len(row) > SUGGESTED_COL else "").strip()
        if not stage or ":" not in stage:
            continue
        screen_id = stage.split(":", 1)[0].strip()
        if screen_id.upper() == "GLOBAL":
            # The GLOBAL three-paths block is not a per-screen context; it
            # belongs in the base system prompt, not the bundle. Skipped here.
            continue
        if not suggested:
            continue
        beats[screen_id] = suggested
    return beats


def split_header(context_block: str) -> str:
    """Return the SCREEN_ID/SCREEN_NAME/ROUTE header (everything up to the first
    blank line). The app's format puts the header, a blank line, then the body."""
    head, _, _ = context_block.partition("\n\n")
    return head


def main() -> int:
    ap = argparse.ArgumentParser(description="Apply onboarding beats into the screen-context bundle.")
    ap.add_argument("--only", help="Apply just this SCREEN_ID (e.g. ONBOARD-01--FORM).")
    ap.add_argument("--dry-run", action="store_true", help="Show changes, write nothing.")
    ap.add_argument("--sa", help="Path to the service-account JSON.")
    args = ap.parse_args()

    sa_path = resolve_sa(args.sa)
    beats = fetch_beats(sa_path)
    if args.only:
        beats = {k: v for k, v in beats.items() if k == args.only}
        if not beats:
            print(f"ERROR: no beat found for {args.only!r} in the Sheet.", file=sys.stderr)
            return 2

    bundle = json.loads(BUNDLE_PATH.read_text(encoding="utf-8"))
    screens = bundle["screens"]

    changed, skipped = [], []
    for screen_id, beat in sorted(beats.items()):
        entry = screens.get(screen_id)
        if entry is None:
            skipped.append(screen_id)
            continue
        header = split_header(entry["context_block"])
        new_block = f"{header}\n\n{beat}"
        if new_block == entry["context_block"]:
            continue
        entry["context_block"] = new_block
        entry["content_hash"] = canonical_hash(new_block)
        entry["source"] = "onboarding-beats-sheet"
        changed.append(screen_id)

    if skipped:
        print(f"  skipped (no matching screen in bundle): {', '.join(skipped)}")
    if not changed:
        print("No changes. Bundle already matches the beats.")
        return 0

    bundle["version"] = datetime.date.today().isoformat()

    print(f"  {'WOULD UPDATE' if args.dry_run else 'UPDATED'} {len(changed)} screen(s): {', '.join(changed)}")
    print(f"  bundle version -> {bundle['version']}")

    if args.dry_run:
        print("Dry run: nothing written.")
        return 0

    BUNDLE_PATH.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {BUNDLE_PATH.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
