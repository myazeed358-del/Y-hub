#!/usr/bin/env bash
# Local native Auth/PostgREST/SQL only; accepts no remote database URL.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -B -m unittest discover -s artifacts/y-hub/supabase/tests/integration -p 'test_attendance.py' -v
