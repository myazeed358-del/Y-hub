# Adding a math engine without changing existing engines

The application can adopt `services/math/ports` as a typed extension boundary. Engine implementations never import UI, storage, or this composition-root directory.

```typescript
import { createDomainEnginePort, DomainEngineCatalog } from '@/services/math/ports';

interface ExampleRequest { value: number }
interface ExampleResult { doubled: number }

const example = createDomainEnginePort<ExampleRequest, ExampleResult>(
  'example',
  (v): v is ExampleRequest =>
    typeof v === 'object' && v !== null &&
    'value' in v && typeof v.value === 'number' && Number.isFinite(v.value),
  request => ({ doubled: 2 * request.value }),
  (v): v is ExampleResult =>
    typeof v === 'object' && v !== null &&
    'doubled' in v && typeof v.doubled === 'number' && Number.isFinite(v.doubled),
);

const catalog = new DomainEngineCatalog().register(example);
const output: unknown = await catalog.run('example', { value: 5 });
const typedOutput: ExampleResult = await example.execute({ value: 5 });
```

`catalog.run` intentionally returns `unknown`: dynamic strings cannot prove request or output types. Prefer a typed port when calling from TypeScript application code. A successful HTTP response must never replace operation-specific result validation. The core `MathEngineRegistry` remains available for `MathProblemRequest → MathResult` extensions.

When adding a new engine: create an independently testable implementation and port, write contract and regression tests, register at the application's composition root, and run the architecture audit, TypeScript checker, Vitest, Python tests, and a full build on Codespaces before merging.

For an engine UI, expose a default public feature entry point and add `src/modules/<id>/module.ts` as described in [PLUGIN_CONTRACT.md](PLUGIN_CONTRACT.md). That manifest automatically contributes guarded lazy routes and optional sidebar/dashboard entries. UI discovery and computation registration are distinct contracts; a new mathematical operation still needs explicit classifier support and correctness tests.

## Module classification (API 2)

An engine UI manifest must explicitly set `apiVersion: 2` and `kind: 'engine'`. Choose its `category` independently (for example mathematics or physics), and declare its access policy and optional navigation group separately. `access.majors` controls eligibility/academic discovery; it never determines whether the product is an engine. Existing mathematical tools, including the interactive Fuzzy Logic Lab engine, retain their original tools-area placement and permissions.

Only accepted engine-kind modules appear in `ENGINE_CATALOG`, engine route selectors, engine search and engine tooltips. General application and laboratory modules use the same discovery, guarded lazy routing, dependency validation and failure isolation, but do not enter those engine-specific consumers. A capability named engine cannot opt an application into the engine catalog. Applications and laboratories can declare their own `applications` or `laboratories` navigation destination and optional dashboard contribution without editing the host's module inventory.

See [the API-2 contract and minimal standalone application example](PLUGIN_CONTRACT.md#minimal-future-standalone-application-manifest). API-1/unclassified manifests are rejected safely; migrate kind, category and each navigation group explicitly. Classification does not register a mathematical operation or prove correctness: computation ports still require their own request/result validation and regression tests. No new engine or application is implemented by these examples.
