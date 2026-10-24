#!/usr/bin/env bash
# Real local Auth/PostgREST only; no remote URL accepted.
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
for image in postgres:16-alpine supabase/gotrue:v2.177.0 postgrest/postgrest:v12.2.3; do
  docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"
done
python3 -B -m unittest discover -s artifacts/y-hub/supabase/tests/integration -p 'test_tutor.py' -v
