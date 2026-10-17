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
