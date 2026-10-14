# Verification checklist for the refactored archive

Do not run this on `main`. After comparing the archive with your repository, import the changes onto a **new branch**, and run the following commands from repository root in Codespaces:

```bash
pnpm install --frozen-lockfile
pnpm --filter y-hub typecheck
pnpm --filter y-hub exec vitest run
pnpm --filter y-hub build
python3 -B tools/audit_architecture.py
```

Install Python development dependencies in a venv if needed, then run:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=artifacts/y-hub/python:artifacts/y-hub \
  python -m unittest discover -s artifacts/y-hub/python/tests -p 'test_*.py' -v
```

Check UI manually: login, course list, document analysis/quiz, 404 fallback, PDF export, calculus, ODE, fuzzy, and linear-algebra fallback behavior. For the Python phase API, verify the actual backend that is running before testing an adapter. In particular, do not interpret an HTTP 200 without a complete math result as successful computation.

**Status at packaging time:** the archive does not include `node_modules`; therefore this session did not run the full Vitest suite, `pnpm typecheck` with resolved external packages, or a production Vite build. New tests are present for running in Codespaces, not represented as passed. No Supabase mutations or deployment operations were performed.

## Phase 2 additional safeguards

For the *second* refactoring pass, run `bash scripts/verify-architecture-refactor.sh` after installing dependencies in the repository's own environment. The script performs: strict architecture audit, workspace typecheck, all Y-Hub Vitest tests, Vite build, and Python unit tests. It stops at the first failure. The presence of this script is not proof that these steps passed here.

New tests cover the registry contract (`services/math/orchestration/__tests__`), analysis boundaries (`analysis/__tests__`), AST toolkit (`symbolic/__tests__`), strict versioned Python response validation (`python/__tests__`), and safe report HTML (`features/solver/services/__tests__`).
