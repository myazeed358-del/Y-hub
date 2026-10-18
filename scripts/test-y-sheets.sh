#!/usr/bin/env bash
# Always disposable/local: accepts no database URL.
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
container="yhub-sheets-test-$(date +%s)-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep .25
done
psql_file() { docker exec -i "$container" psql -h 127.0.0.1 -X -U postgres -v ON_ERROR_STOP=1 < "$1"; }
psql_file artifacts/y-hub/supabase/tests/audit/bootstrap.sql >/dev/null
for migration in artifacts/y-hub/supabase/migrations/*.sql; do
  if [[ $(basename "$migration") == 0024_* ]]; then
    docker exec -i "$container" psql -h 127.0.0.1 -X -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA test;
GRANT USAGE ON SCHEMA test TO authenticated;
CREATE FUNCTION test.expect(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '%', label; END IF; RAISE NOTICE 'PASS %', label; END $$;
SQL
    psql_file artifacts/y-hub/supabase/tests/database/y_sheets_isolated.sql >/dev/null
  fi
  psql_file "$migration" >/dev/null
done
YHUB_SHEETS_TEST_CONTAINER="$container" python3 -B -m unittest discover -s artifacts/y-hub/supabase/tests/y-sheets -p 'test_*.py' -v
