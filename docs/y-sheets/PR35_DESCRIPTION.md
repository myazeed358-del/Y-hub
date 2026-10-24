Y-Sheets now keeps its fullscreen editor controls in one Ribbon and preserves the existing My Files, cloud-save and recovery flows. This review fixes data loss in overlapping/cross-sheet cut and clipped paste, stale directory responses, wrong import/export panels, filter-toggle behavior, keyboard accessibility and dark-theme/brand issues.

A real local Auth/PostgREST regression also found that application conflicts using SQLSTATE 40001 were retried until timeout. Migration 0037 changes only Y-Sheets save/delete application conflicts to PT409, preserving account isolation, CAS and idempotency. No production migration has been applied; privileged ledger access and hosted verification remain pending.

Validation after merging main 80fab4b8a026f508f63bdbcc7edb09da0cf6a622 into this branch:

- 1,899 Vitest tests / 219 files; includes 139 focused Y-Sheets tests.
- 36 Python tests; 8 architecture guard tests; workspace TypeScript and all boundary audits passed.
- Production build passed with the existing large-chunk warning.
- 10 isolated PostgreSQL RPC tests + 14 historical SQL assertions; 5 native local GoTrue JWT/PostgREST integration tests.
- Chromium: 16 fullscreen layout combinations, 4 full file/recovery/conflict workflows, and real Excel-worker/editor checks.

See docs/y-sheets/FINAL_UI_REVIEW.md and UI_REVIEW_CHANGED_FILES.md for defects, evidence, reproducible commands, migration scope and release gates. Hosted tests are not claimed. GitHub API access is currently blocked, so required-check verification and merge must remain pending until access is available. No unrelated feature, mathematical engine, historical migration or Vercel setting changed.
