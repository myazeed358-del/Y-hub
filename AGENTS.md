# Y-Hub engineering instructions

Work in the existing isolated checkout; do not create worktrees unless requested.
Read docs/architecture/AGENT_HANDOFF.md and REFACTOR_PROGRESS.md before resuming.
The application is artifacts/y-hub; pnpm workspace contains the app, design system, and mockup sandbox.

## Boundaries and protected behavior
Preserve existing feature ownership, public math ports, algorithms, theme/colors, URLs, role/major guards, enrollment identities, and student numbers. No production database writes, migrations, RLS changes, secret commits, force-pushes, or main merges without explicit authorization.
Feature implementations must not import unrelated feature internals. Application composition may integrate feature public entry points. Math computation must remain independent of React, storage, and composition roots.
See BOUNDARIES.md and PLUGIN_CONTRACT.md under docs/architecture.

## Verification
Node 24; pnpm 9.12.0. In this environment use /workspace/.yhub-tools/node_modules/.bin/pnpm and /workspace/.yhub-venv/bin/python.
From repository root: python3 -B tools/audit_architecture.py --strict; python3 -B tools/check_math_boundaries.py; pnpm --filter y-hub typecheck; pnpm --filter y-hub exec vitest run --maxWorkers=2 --minWorkers=1; pnpm --filter y-hub build.
Python: PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=artifacts/y-hub/python:artifacts/y-hub /workspace/.yhub-venv/bin/python -m unittest discover -s artifacts/y-hub/python/tests -p 'test_*.py' -v.
Typecheck other workspace packages with pnpm --filter './artifacts/**' -r exec tsc -p tsconfig.json --noEmit; avoid design-token generation unless intentionally changing tokens.
Never substitute a build for behavioral tests or claim anonymous Supabase requests prove RLS correctness.
Run node --test tools/check_module_boundaries.test.mjs and node tools/check_module_boundaries.mjs for compiler-resolved module/public-feature imports and runtime cycles. The complete suite is scripts/verify-architecture-refactor.sh (set PATH to pinned pnpm and YHUB_PYTHON to the prepared interpreter).

## Git checkpoints and recovery
Use refactor/architecture-plug-and-play; inspect remote and local changes before switching. Do not overwrite unrelated work. Implement small packages, test, update progress/handoff, commit, push normally, and verify remote SHA using git ls-remote.
Record the previous verified remote SHA in the next checkpoint document; a commit cannot contain its own hash. Git history and ls-remote establish the newest checkpoint.
PRs are for review; never automatically merge. If API or push access fails, document the exact limitation and continue safe independent work.
