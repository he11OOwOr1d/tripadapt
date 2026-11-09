#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
DATA="$PWD/.local/postgres"
if [ ! -x "$PG_BIN/pg_ctl" ]; then
  echo 'PostgreSQL 17 is missing. Install it or set PG_BIN to its bin directory.' >&2
  exit 1
fi
if [ "${1:-start}" = stop ]; then
  "$PG_BIN/pg_ctl" -D "$DATA" stop
  exit
fi
mkdir -p .local
if [ ! -f "$DATA/PG_VERSION" ]; then
  "$PG_BIN/initdb" -D "$DATA" --username=tripadapt --auth-local=trust --auth-host=scram-sha-256 --pwfile=<(printf '%s\n' tripadapt) --encoding=UTF8 --locale=C
fi
if ! "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA" -l "$PWD/.local/postgres.log" -o "-h 127.0.0.1 -p 5432 -k $PWD/.local" start
fi
if ! "$PG_BIN/psql" -h "$PWD/.local" -U tripadapt -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='tripadapt'" | rg -q 1; then
  "$PG_BIN/createdb" -h "$PWD/.local" -U tripadapt tripadapt
fi
