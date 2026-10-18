#!/usr/bin/env bash
# No database URL accepted. This script can only operate on its own ephemeral local container.
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
container="yhub-exam-test-$(date +%s)-$$"
image="postgres:16-alpine"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# No published port and no network: neither tests nor database can contact production.
docker run --detach --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.25
done
psql_file() { docker exec -i "$container" psql -h 127.0.0.1 -X -U postgres -v ON_ERROR_STOP=1 < "$1"; }
log="$(mktemp /tmp/yhub-audit-migrations.XXXXXX.log)"
if ! (
  psql_file artifacts/y-hub/supabase/tests/audit/bootstrap.sql || exit 1
  for migration in artifacts/y-hub/supabase/migrations/*.sql; do
    if [[ $(basename "$migration") == 0022_* ]]; then psql_file artifacts/y-hub/supabase/tests/audit/seed.sql || exit 1; fi
    psql_file "$migration" || exit 1
  done
) >"$log" 2>&1; then cat "$log"; exit 1; fi
printf 'Historical migrations and audit migration applied locally. Log: %s\n' "$log"
YHUB_EXAM_TEST_CONTAINER="$container" python3 -B -m unittest discover -s artifacts/y-hub/supabase/tests/exams -p 'test_*.py' -v
psql_file artifacts/y-hub/supabase/tests/0018_user_numbers.sql > /dev/null
printf 'PASS: isolated exam attempts, grading, timing and RLS tests\n'
