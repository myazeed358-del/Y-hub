# Y-Hub architecture boundaries

## Intent

Keep course and UI features self-contained, keep mathematical engines independent of React, keep shared modules free of feature-specific business logic, and keep legacy entry points as compatibility facades until all consumers are migrated.

## Ownership

| Owner | Owns | May depend on |
|---|---|---|
| `features/course-manager/domain` | Course models, study timeline generation | Its own domain types |
| `features/course-manager/storage` | IndexedDB persistence | Course domain types; browser IndexedDB |
| `features/course-manager/services` | Course-specific cloud sync | Course storage; Supabase connector |
| `features/ai-generator/lesson-plan` | Prototype lesson generation | AI-generator domain |
| `features/solver/services` | Solver reporting/export | Solver domain |
| `shared/ui` | Reusable presentation components | Presentation packages, shared UI |
| `services/math/ode` | ODE engines and single/system orchestration | Shared symbolic/domain/types and optional Python boundary |
| `services/math/python/phaseClient.ts` | HTTP transport for the phase-based FastAPI API | Web fetch/AbortController only |
| `services/math/python/*Mapping.ts` | Python result validation and mapping to math domain | Domain types; phase response type |
| `utils/pdfEngine.ts`, `utils/courseStorage.ts`, `utils/pdfExport.ts`, `utils/cloudStorage.ts` | Compatibility exports only | Feature-owned implementation during migration |

## Protocol separation

**Phase protocol** (`artifacts/y-hub/python/api/server.py`) takes `operation`, `phase`, `mode`, `input`, and returns `status` and `result`. Its TypeScript client is `phaseClient.ts`.

**Versioned AST protocol** (`python_math_service/app/main.py`) takes `protocol_version`, `expression_ast`, `limits`, and returns `success` and `result_ast`. Its TS client is `PythonMathAdapter` (`services/math/python/adapter.ts`). These two protocols share an example default URL but **must not be mistaken for one another in deployment**.

## Correctness policy

- No mathematical result is considered solved if its domain-result fields are absent or malformed.
- Never turn an unsupported CanonicalAST expression into the numeric value zero.
- Exact rational values must remain exact strings/AST until their representation is explicitly changed.
- Network failures, unsupported algorithms, or invalid response schemas must use a documented fallback, not invented solutions.
- Keep public APIs (old import paths) intact during incremental moves. Only remove facades after a complete consumer scan and test coverage.
- Validate `git diff`, typecheck, unit tests, and production build on the user’s Codespaces before merge.

## Static audit limitations

`tools/audit_architecture.py` only understands static relative imports and the application's `@/` alias. It is not a substitute for TypeScript compiler analysis, dynamic imports, dependency inversion reviews, database policy review, or runtime integration tests.

## Second refactoring pass — dedicated math responsibilities

| Owner | Responsibility | Public entry point |
|---|---|---|
| `services/math/analysis/functionClassification.ts` | Pure function-family classification from AST | `classifyFunction` |
| `services/math/analysis/graphDataBuilder.ts` | Plot metadata and monotonicity/concavity segments | `GraphDataBuilder.build` |
| `services/math/analysis/asymptoteAnalyzer.ts` | Limit-based asymptote analysis | `AsymptoteAnalyzer.analyze` |
| `services/math/symbolic/inequalityAstToolkit.ts` | Stateless AST/endpoint transforms used by inequality strategies | `InequalityAstToolkit` |
| `services/math/symbolic/integrationStrategies/basicRules.ts` | Elementary integration recognition | `BasicIntegrationRules.matchBasicPattern` |
| `services/math/symbolic/integrationStrategies/chainRule.ts` | Chain rule recognizer | `ChainRuleIntegration.matchChainRule` |
| `services/math/verification/antiderivative.ts` | Verify antiderivative using independent differentiation | `AntiderivativeVerifier.verify` |
| `services/math/orchestration/engineRegistry.ts` | Typed extension point for registering math engines | `MathEngineRegistry` and `MathEnginePort` |
| `services/math/python/versionedResponse.ts` | Runtime protocol discriminator for versioned Python backend | `isVersionedMathResponse` |
| `features/solver/services/renderSolverReportHtml.ts` | Pure, HTML-escaped printable document formatting | `renderSolverReportHtml` |
| `features/solver/services/printSolverReport.ts` | Browser popup/printing side effect only | `exportToPDF` |

### Adding a math engine without reorganizing the core

1. Implement `MathEnginePort` in a standalone module, returning a **complete** `MathResult`. The result's `type`, `steps`, `warnings`, `conditions`, and `engineUsed` are required; each result kind has additional required fields.
2. In the composition root, instantiate `new MathEngineRegistry().register(engine)`; pass the registry into `new MathOrchestrator(registry)`. Built-in routing remains unchanged when no plug-in supports the classified request.
3. The plug-in's `supports()` runs after parsing/classification and domain analysis. If a new operation is introduced, extend the operation type and classifier explicitly. Registering an engine does **not** automatically add a UI page, API route or permissions.
4. Add isolated behavior/contract tests before enabling its route. Results that lack required properties cause an error instead of silently becoming a successful answer.

The runtime check is intentionally lightweight; a specialised engine must additionally validate domain-specific result fields and mathematical correctness. No interface can prove that an arbitrary mathematical formula is correct.

### Automated checks

Run `python3 -B tools/audit_architecture.py --strict` or `bash scripts/verify-architecture-refactor.sh`. The latter requires project dependencies already installed (e.g. `pnpm install --frozen-lockfile`). Static checks guard cycles and direct cross-feature imports, but do not replace compiler, tests or runtime integration checks.
