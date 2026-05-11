"""Deterministic hashing for sheet rows.

Same dict → same hash regardless of key insertion order.
Used to short-circuit no-op upserts in seed_contexts.py.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_hash(obj: Any) -> str:
    payload = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
