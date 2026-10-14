#!/usr/bin/env bash
# Run from a Codespaces checkout, on a feature branch. Never modifies source files.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo 'ERROR: pnpm is required (use the repo packageManager version)' >&2
  exit 1
fi

echo '===== ARCHITECTURE BOUNDARIES ====='
python3 -B tools/audit_architecture.py --strict
python3 -B tools/check_math_boundaries.py

echo '===== TYPESCRIPT TYPECHECK ====='
pnpm typecheck

echo '===== VITEST ====='
pnpm --filter y-hub exec vitest run

echo '===== VITE BUILD ====='
pnpm --filter y-hub build

echo '===== PYTHON TESTS ====='
PYTHON_BIN="${YHUB_PYTHON:-python3}"
if ! "$PYTHON_BIN" -c "import sympy, fastapi" > /dev/null 2>&1; then
  echo "ERROR: Python dependencies missing. Set YHUB_PYTHON to a prepared virtualenv interpreter." >&2
  exit 1
fi
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=artifacts/y-hub/python:artifacts/y-hub \
  "$PYTHON_BIN" -m unittest discover -s artifacts/y-hub/python/tests -p 'test_*.py' -v

echo 'PASS: complete architecture verification suite'
