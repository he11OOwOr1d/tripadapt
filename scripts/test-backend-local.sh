#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../services/backend"

if [[ -n "${PG_BIN:-}" ]]; then
  initdb_cmd="$PG_BIN/initdb"
  pg_ctl_cmd="$PG_BIN/pg_ctl"
else
  initdb_cmd=initdb
  pg_ctl_cmd=pg_ctl
fi
for tool in "$initdb_cmd" "$pg_ctl_cmd" uv; do
  if ! command -v "$tool" >/dev/null; then
    echo "Missing $tool. Install PostgreSQL and uv, or set PG_BIN to PostgreSQL's bin directory." >&2
    exit 1
  fi
done

# A short private socket path avoids TCP port conflicts and the Unix socket path limit.
cluster=$(mktemp -d /tmp/elsewhere-test.XXXXXX)
cleanup() {
  if "$pg_ctl_cmd" -D "$cluster/data" status >/dev/null 2>&1; then
    "$pg_ctl_cmd" -D "$cluster/data" -m fast stop >/dev/null || return
  fi
  rm -rf -- "$cluster"
}
trap cleanup EXIT
"$initdb_cmd" -D "$cluster/data" -U postgres -A trust --encoding=UTF8 --locale=C >/dev/null
if ! "$pg_ctl_cmd" -D "$cluster/data" -o "-h '' -k $cluster" -l "$cluster/server.log" start; then
  cat "$cluster/server.log" >&2
  exit 1
fi

export DATABASE_URL="postgresql+psycopg://postgres@/postgres?host=$cluster"
uv run --locked alembic upgrade head
uv run --locked alembic check
uv run --locked pytest "$@"
