"""baseline: represents production schema at Alembic cutover

Revision ID: 0001_baseline
Revises:
Create Date: 2026-04-17

Empty on purpose. Production already contains the schema created by
supabase/migrations/000_schema.sql through 009_*.sql. On each existing
environment, run once:

    alembic stamp 0001_baseline

...to mark the DB as up-to-date without executing anything. All future
schema changes start at 0002_*.
"""

from __future__ import annotations

from typing import Sequence, Union

revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
