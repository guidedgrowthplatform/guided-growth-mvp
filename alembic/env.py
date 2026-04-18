"""Alembic environment.

Reads DATABASE_URL from the environment. In CI it's injected from GitHub
secrets; locally it comes from .env (via python-dotenv).

Raw-SQL migrations only: no target_metadata, no autogenerate. Schema is
defined in TypeScript (packages/shared/src/types), so autogenerate would
drift. Keep migrations as explicit op.execute() blocks.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

load_dotenv(".env.local")
load_dotenv(".env", override=False)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Define it in .env.local for local runs "
        "or inject it as a GitHub Actions secret in CI."
    )

config.set_main_option("sqlalchemy.url", database_url)

target_metadata = None


def run_migrations_offline() -> None:
    """Render SQL to stdout without connecting. Used by the PR dry-run job."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            transaction_per_migration=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
