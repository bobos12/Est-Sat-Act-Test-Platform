#!/usr/bin/env bash
# Usage: PGHOST=/tmp/pg PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists nm_test" -c "create database nm_test"
for f in tests/supabase_stubs.sql migrations/*.sql; do $P -d nm_test -f "$f"; done
out=$($P -d nm_test -t -A -F' | ' -f tests/engine_test.sql 2>&1 | grep -v '^$')
echo "$out"
if echo "$out" | grep -qE '\| f$|ERROR'; then echo "FAILED"; exit 1; fi
echo "ALL CHECKS PASSED ($(echo "$out" | wc -l) checks)"
