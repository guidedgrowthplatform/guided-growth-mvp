"""Google Sheets client with service-account auth + retry-with-backoff.

Auth resolution order:
1. GOOGLE_SERVICE_ACCOUNT_JSON env var (CI: full JSON as one string).
2. GOOGLE_APPLICATION_CREDENTIALS env var (local: file path, defaults to project-root service-account.json).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_CREDS_PATH = PROJECT_ROOT / "service-account.json"

T = TypeVar("T")


def _get_credentials() -> service_account.Credentials:
    raw_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if raw_json:
        info = json.loads(raw_json)
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    creds_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    creds_path = Path(creds_env).expanduser().resolve() if creds_env else DEFAULT_CREDS_PATH
    if not creds_path.exists():
        raise FileNotFoundError(
            f"No service-account credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON env var, "
            f"or place service-account.json at {DEFAULT_CREDS_PATH}, "
            f"or set GOOGLE_APPLICATION_CREDENTIALS to its path."
        )
    return service_account.Credentials.from_service_account_file(str(creds_path), scopes=SCOPES)


def with_retry(fn: Callable[[], T], *, tries: int = 4, base_ms: int = 500) -> T:
    """Exponential backoff on 429/5xx, abort on other 4xx."""
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except HttpError as exc:
            status = getattr(getattr(exc, "resp", None), "status", None)
            retryable = status in (429, 500, 502, 503, 504)
            if not retryable or attempt == tries:
                raise
            wait = (base_ms / 1000) * (2 ** (attempt - 1))
            print(f"[sheets retry {attempt}/{tries}] HTTP {status}, sleeping {wait:.1f}s",
                  file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("with_retry exhausted without raising — unreachable")


def _build_service():
    return build("sheets", "v4", credentials=_get_credentials(), cache_discovery=False)


def get_sheet_header(sheet_id: str, tab: str) -> list[str]:
    """Fetch only row 1 of `tab`. Returns the header strings (empty list if no header)."""
    service = _build_service()
    result = with_retry(
        lambda: service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=f"'{tab}'!1:1")
        .execute()
    )
    values = result.get("values", [])
    return list(values[0]) if values else []


def get_sheet_rows(sheet_id: str, tab: str) -> list[dict[str, Any]]:
    """Fetch all rows from `tab` as dicts keyed by the header row.

    Short rows (cells trimmed by Google when trailing cells are empty) are padded
    so every dict has the full set of header keys — simpler downstream code.
    """
    service = _build_service()
    result = with_retry(
        lambda: service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=tab)
        .execute()
    )
    values = result.get("values", [])
    if not values:
        return []

    header = values[0]
    rows: list[dict[str, Any]] = []
    for raw in values[1:]:
        padded = list(raw) + [""] * (len(header) - len(raw))
        rows.append(dict(zip(header, padded)))
    return rows
