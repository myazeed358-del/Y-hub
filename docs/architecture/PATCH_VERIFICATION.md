# Applying Phase 3 changes

The Phase 3 incremental patch is based **only** on `Y-Hub-Architecture-Refactor-Phase2-2026-10-14.zip`. Do not apply it to GitHub `main` without first applying the earlier refactor stages. The standalone Phase 3 ZIP already contains all changes from the previous stages and does not require applying the patch.

On a clean copy of the Phase 2 source, from the repository root:

```bash
git switch -c refactor/yhub-phase3-engines
git apply --check /path/to/Y-Hub-Architecture-Phase3-From-Phase2.patch
git apply /path/to/Y-Hub-Architecture-Phase3-From-Phase2.patch
pnpm install --frozen-lockfile
bash scripts/verify-architecture-refactor.sh
```

This patch was additionally checked for applicability and content equality in an isolated folder during packaging. **This is not an assertion that the installed TypeScript dependency test suite and Vite build passed.** No source changes were merged automatically into GitHub.
