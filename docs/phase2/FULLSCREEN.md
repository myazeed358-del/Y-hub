# Fullscreen application shell — review evidence

Base: `b86dc42` (main, PRs #19–#22 merged). Branch: `feature/fullscreen-application-shell`.

Confirmed defects: authenticated modules always inherited the dashboard shell; workbook height used `calc(100vh - 220px)` plus a 500px minimum; click interception did not protect browser history navigation or ask before leaving unsaved work.

API 2 gains optional `routes[].layout: 'standard' | 'fullscreen'`. Omission is standard. Registry validates it; accepted, enabled routes and the existing role/major/permission policy select presentation. AppRoutes/ProtectedRoute, lazy loading, providers and error boundaries still execute. No path-specific Y-Sheets condition or registration list is added. Standard AppShell is unchanged and is remounted on returning to Dashboard.

Fullscreen is a normal flex container (100vh fallback, 100dvh, min-size zero, internal overflow). Y-Sheets files and editor fill it. Grid scrolling remains internal; the spreadsheet's coordinate surface stays LTR inside a localized RTL/LTR workspace, matching existing column geometry. Local toolbar/theme styling stays scoped. Return control remains outside the horizontally scrollable recovery controls. Existing mathematical algorithms, services and database migrations are untouched.

The shared guarded location hook owns Wouter navigation and indexed history. A rejected Back/Forward restores the prior history index without publishing a route update/unmounting the editor. Internal push/replace use the same guard. Unknown entries created outside this router cannot be traversed by a known delta: cancellation restores the current URL with a new entry, retaining the editor. Cross-document reload/exit uses the existing beforeunload warning. No claim that browser termination or storage clearing can be prevented.

Dirty, draft, in-flight, conflict and failed states reuse WorkbookSession/RecoveryJournal. Confirmation explicitly offers retaining browser-local recovery. Failure to write that recovery blocks departure; no default document replaces work. There is no second save protocol, forced conflict overwrite or claim of cross-device backup. The user may stay and retry/export/save a copy with the existing controls.

Browser evidence uses the real application, AuthProvider, registry, router and CSS with synthetic intercepted HTTP responses, never real accounts or production writes. Sixteen geometry cases: 1920×1080, 1366×768, 768×1024, 390×844 × Arabic/English × light/dark. Asserts viewport occupancy, grid/formula separation, internal two-axis scrolling, visible return control, absent host sidebar/header, no outer overflow. Also exercises denied Back/return, acknowledged local recovery after conflict, restoration after re-entry, shell restoration and guest login denial. Screenshots: `/tmp/yhub-phase2-screenshots/` (synthetic data only). Repeat with `YHUB_PLAYWRIGHT_MODULE=/workspace/.yhub-browser/node_modules/playwright-core/index.mjs node scripts/test-fullscreen-browser.mjs` and local Vite on port 5175.

Fresh verification results are recorded in the final checkpoint below. Real Supabase staging and real two-device save/recovery remain PENDING; the user confirmed no staging. No production migration was run.

## Verified checkpoint

- Complete verification script PASS: 1830 Vitest tests / 208 files, 29 Python tests, eight boundary guard tests, root + all artifact TypeScript checks, architecture/math/module audits and production build. Log `/tmp/phase2-a-full.log`.
- Final additional CSS isolation assertion: 5/5 tests in the CSS suite (four already included above, one new), `/tmp/phase2-a-css.log`.
- PostgreSQL Y-Sheets: 10/10 tests plus 14 historical RLS assertions, `/tmp/phase2-a-sql.log`.
- Chromium: all 16 geometry cases and navigation/recovery scenarios PASS, `/tmp/phase2-a-browser.log`.
- No failed or skipped final cases. Large build chunk / existing dependency warnings remain. No dependency, algorithm or migration changes in this PR.
- GitHub API still returns `Post "https://api.github.com/graphql": Forbidden`; native Git remains usable. PR creation will be attempted after pushing; no CI/deployment check is waived.

Release safety: 0025/0026 are present on main but production migration status is UNKNOWN. A read-only OpenAPI request returned 401; no RPC (including the mutating attempt-status RPC) was invoked. Staging verification is PENDING, not a proven outage and not production readiness.
