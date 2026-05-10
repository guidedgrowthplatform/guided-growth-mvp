"""Supabase service-role client. Bypasses RLS for the seeder."""

from __future__ import annotations

import os
from typing import Optional

from supabase import Client, create_client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "(in .env locally, GitHub repo secrets in CI)."
        )
    _client = create_client(url, key)
    return _client
