#!/usr/bin/env bash
# Real auth/JWT/HTTP on ephemeral local containers, never an external Supabase URL.
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
for image in postgres:16-alpine supabase/gotrue:v2.177.0 postgrest/postgrest:v12.2.3; do
  if ! docker image inspect "$image" >/dev/null 2>&1; then docker pull "$image"; fi
done
python3 -B -m unittest discover -s artifacts/y-hub/supabase/tests/integration -p 'test_*.py' -v
