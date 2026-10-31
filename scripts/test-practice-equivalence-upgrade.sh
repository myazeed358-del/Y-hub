#!/usr/bin/env bash
# Upgrade existing 0050 attempts in a disposable, network-isolated local database.
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
container="yhub-academic-test-upgrade-$(date +%s)-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --detach --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.25
done
psql_file() { docker exec -i "$container" psql -h 127.0.0.1 -X -U postgres -v ON_ERROR_STOP=1 < "$1"; }
log="$(mktemp /tmp/yhub-practice-upgrade.XXXXXX.log)"
if ! (
  psql_file artifacts/y-hub/supabase/tests/audit/bootstrap.sql || exit 1
  for migration in artifacts/y-hub/supabase/migrations/*.sql; do
    if [[ $(basename "$migration") == 0051_* ]]; then break; fi
    if [[ $(basename "$migration") == 0022_* ]]; then psql_file artifacts/y-hub/supabase/tests/audit/seed.sql || exit 1; fi
    if [[ $(basename "$migration") == 0027_* ]]; then psql_file artifacts/y-hub/supabase/tests/academic/legacy.sql || exit 1; fi
    psql_file "$migration" || exit 1
  done
) >"$log" 2>&1; then cat "$log"; exit 1; fi
YHUB_ACADEMIC_TEST_CONTAINER="$container" python3 -B artifacts/y-hub/supabase/tests/upgrade/practice_equivalence.py
