# Test baseline — 2026-10-17

Commit cca4f313097cbcf72488234a8df601dd00a8df48; verified immediately before this assignment in the same environment. No source changes since those checks. Node 24.19.0, pnpm 9.12.0, TypeScript 5.9.3, Vite 7.3.6, Python 3.12.14.
Use /workspace/.yhub-tools/node_modules/.bin/pnpm in this cloud machine.

| Command from repository root | Actual result |
|---|---|
| pnpm exec tsc --build | Passed |
| pnpm --filter './artifacts/**' -r exec tsc -p tsconfig.json --noEmit | All three artifact packages passed |
| pnpm --filter y-hub exec vitest run --maxWorkers=2 --minWorkers=1 | 178 files, 1558 tests passed, no reported failures/skips; 80.99 seconds |
| pnpm --filter y-hub build | Passed; 55.60 seconds |
| python3 -B tools/audit_architecture.py --strict | Passed |
| python3 -B tools/check_math_boundaries.py | Passed |
| PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=artifacts/y-hub/python:artifacts/y-hub /workspace/.yhub-venv/bin/python -m unittest discover -s artifacts/y-hub/python/tests -p 'test_*.py' -v | 29 tests passed |
| Python pip check / pnpm list -r --depth 0 | Dependencies resolve |
| Lint | No configured lint script; not executed |

Production largest JS chunk: 8113.98 kB / 2410.89 kB gzip. Warnings: Vite large chunks; PDF.js Node legacy-build recommendation; Starlette httpx test-client deprecation. No existing compiler or test failures.

Vite HTML and transformed main/Supabase modules served successfully. Phase Python API: health, CORS preflight and matrix determinant (-2) passed through the external local wrapper. Alternate versioned Python service not prepared.

Supabase SDK initialized and Auth settings GET returned 200. Zero-row reads of seven application tables returned 401/42501 permission denied; schema discovery requires a secret key. Initial generic profiles probe returned PGRST205; this app uses users, not profiles. No data fetched or changed. Authenticated roles, RLS, migration deployment and complete browser workflows remain unverified. API checks are not backend-security certification.
