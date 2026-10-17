# Architecture audit — 2026-10-17

Baseline: cca4f313097cbcf72488234a8df601dd00a8df48, verified against GitHub main. Checkout was clean.
Existing full-architecture and phase3 branches are ancestors of main. The unmerged engine-navigation-catalog branch contains three focused commits consolidating sidebar metadata; reuse this work instead of recreating it.
GitHub REST/GraphQL open-PR inspection returned Forbidden; no claim that there are no open PRs.

| Area | State | Evidence / work |
|---|---|---|
| App shell | Mostly complete | Controller/view, navigation domain and public API already separated; preserve compatibility tests |
| Routing / engine navigation | Partial | AppRoutes, majorEngineAccess and navigationRoutes duplicate registration; no import.meta.glob discovery |
| Calculus, ODE, linear algebra, fuzzy, symbolic / numeric engines | Mostly complete | Independent math modules, ports, registry and 29 Python / extensive TS regression tests; do not rewrite algorithms |
| Calculus I proof services | Mostly complete | Specialized proof implementations and adversarial tests; large files reflect real algorithms |
| Dashboard / student dashboard | Mostly complete | Components, hooks, repositories exist; preserve stable course IDs and roster v2 RPC |
| Course manager / student course | Mostly complete | Domain, storage, services and handlers exist; authenticated backend integration unverified |
| Exam runner / enrollment / student numbers | Mostly complete locally | RPC boundaries and UI tests; migrations preserve identifiers and authorization |
| Login / reset / profile / guest landing | Mostly complete | Feature-owned presentation and services; AuthContext still combines lifecycle and Supabase |
| Admin / super-admin | Shared implementation | RoleBasedDashboard uses dashboard for instructor/admin/super-admin, not independent applications |
| AI generator | Partial / intentionally mixed prototypes | Search, analysis, chat and quiz separated; remote AI execution not validated |
| Legacy lessons, course plan, quiz, home, lab | Mostly complete | Feature implementations behind intentional compatibility facades |
| Plugin system | Missing integration | Math registry is a computation extension point, not automatic application installation |
| Cleanup | Candidates only | Compatibility paths are tested contracts; perform reference and dynamic-discovery analysis before deleting |
| Database security | External validation blocked | Auth endpoint works; anonymous table reads denied; no signed-in session / production writes |

Static audits: 517 production TS/JS files, 1406 edges, no detected cycles or direct cross-feature imports. One unresolved specifier is main.tsx importing index.css (not a TS dependency). Static regex checks are incomplete and need module-specific enforcement.

Large code is primarily course content, generated UI, and mathematical algorithms. Calculus1Page (615 lines) and OdePage (457 lines) merit targeted responsibility review, not arbitrary splitting.

## Work packages
1. Preserve baseline/recovery records; integrate the existing navigation catalog work.
2. Typed, validated module manifests; deterministic discovery; dependency checks; lazy route composition and shared access policy.
3. Integrate existing engines and prove automatic navigation, route access, invalid-module rejection and local failure isolation with a development fixture.
4. Strengthen boundaries and verified cleanup; preserve math/course contracts and improve concrete defects found during inspection.
5. Full verification, contract documentation, remote checkpoints and review PR.

Keep Supabase configuration, applied migrations, student identifiers, themes, content ownership and core algorithms unchanged. No live backend-security claim follows from passing local tests.
