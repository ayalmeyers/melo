#!/usr/bin/env bash
# Rebuilds a throwaway database from the migrations and runs the security tests.
set -euo pipefail
PG="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54329} -U postgres -v ON_ERROR_STOP=1 -q"
$PG -c "drop database if exists melo_test" -c "create database melo_test"
DB="$PG -d melo_test"
$DB -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do $DB -f "$f"; done
$DB -f supabase/seed.sql
$DB -f supabase/tests/security.sql
for f in supabase/tests/*.sql; do case "$f" in */shim.sql|*/security.sql) ;; *) $DB -f "$f" ;; esac; done
echo "database tests passed"
