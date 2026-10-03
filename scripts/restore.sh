#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${ALLOW_DESTRUCTIVE_RESTORE:?Set ALLOW_DESTRUCTIVE_RESTORE=YES to enable restore}"
if [[ "$ALLOW_DESTRUCTIVE_RESTORE" != "YES" ]]; then
  echo "Refusing restore: ALLOW_DESTRUCTIVE_RESTORE must equal YES." >&2
  exit 1
fi

if [[ "${NODE_ENV:-}" == "production" && "${ALLOW_PRODUCTION_RESTORE:-}" != "YES" ]]; then
  echo "Refusing production restore: set ALLOW_PRODUCTION_RESTORE=YES explicitly." >&2
  exit 1
fi

dump="${1:?Usage: ALLOW_DESTRUCTIVE_RESTORE=YES bash scripts/restore.sh <backup.dump>}"
if [[ ! -f "$dump" ]]; then
  echo "Backup file not found: $dump" >&2
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$DATABASE_URL" \
  "$dump"

printf 'Restore completed from: %s\n' "$dump"
