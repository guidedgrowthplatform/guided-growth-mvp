#!/usr/bin/env bash
# Take a pg_dump snapshot of the target database before applying migrations.
#
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/pre-migrate-snapshot.sh [output_dir]
#
# Requirements:
#   - pg_dump (PostgreSQL client) on PATH. Version should match or exceed
#     the server version. Supabase runs Postgres 15 — use pg_dump 15+.
#   - DATABASE_URL must be a session-mode connection (direct 5432 or the
#     session pooler). Transaction pooler (port 6543) does NOT support
#     pg_dump.
#
# Output:
#   Writes {output_dir}/snapshot-{timestamp}-{shortsha}.dump in custom
#   format. Restore with:
#     pg_restore --clean --if-exists -d $DATABASE_URL snapshot-*.dump
#
# This is a belt-and-suspenders backup. The primary recovery mechanism
# for data loss is Supabase Point-in-Time Recovery (PITR). This snapshot
# is for quick manual rollback when PITR is overkill or unavailable.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found on PATH" >&2
  exit 1
fi

output_dir="${1:-./snapshots}"
mkdir -p "$output_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
short_sha="${GITHUB_SHA:-local}"
short_sha="${short_sha:0:8}"
output_file="${output_dir}/snapshot-${timestamp}-${short_sha}.dump"

echo "Starting pg_dump → ${output_file}"
start_epoch="$(date +%s)"

pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --verbose \
  --file="${output_file}" \
  "${DATABASE_URL}" 2>&1 | grep -E "^(pg_dump:|processing|dumping)" | tail -20 || true

end_epoch="$(date +%s)"
elapsed=$((end_epoch - start_epoch))
size_bytes="$(wc -c <"${output_file}" | tr -d ' ')"
size_mb=$(( size_bytes / 1024 / 1024 ))

echo "Snapshot complete: ${output_file} (${size_mb} MB in ${elapsed}s)"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "snapshot_path=${output_file}" >>"$GITHUB_OUTPUT"
  echo "snapshot_size_mb=${size_mb}" >>"$GITHUB_OUTPUT"
fi
