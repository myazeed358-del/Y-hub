#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bundle=$(mktemp -d /tmp/yhub-university-verify.XXXXXX)
trap 'rm -rf "$bundle"' EXIT
python3 -B tools/export_university_snapshot.py "$bundle"
cd "$bundle"
bash scripts/test-supabase-http.sh
if [[ "${1:-}" != --http-only ]]; then
 bash scripts/verify-architecture-refactor.sh
 for suite in university academic audit-log exam-attempts course-deletion y-sheets; do bash "scripts/test-$suite.sh"; done
 node --test tools/export_module_policy.test.mjs
fi
printf 'PASS: combined university and Phase3 snapshot; no Git merge performed\n'
