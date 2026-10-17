import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importsFrom, importViolation, manifestHasEffects, findCycles } from './check_module_boundaries.mjs';

test('parser includes real static/dynamic imports and excludes strings/comments', () => {
  const imports = importsFrom('example.ts', `
    // import x from '@/features/private';
    const example = "import x from 'fiction'";
    import type { ModuleManifest } from '../contracts';
    export { value } from './public';
    const loader = () => import('@/features/math');
  `);
  assert.deepEqual(imports.map(i => [i.specifier, i.kind, i.typeOnly]), [
    ['../contracts', 'static', true], ['./public', 'static', false], ['@/features/math', 'dynamic', false],
  ]);
});
test('module entries require feature public contracts, including dynamic imports', () => {
  assert.match(importViolation('modules/math/module.ts', 'features/math/pages/Page.tsx', { kind: 'dynamic' }), /public index/);
  assert.equal(importViolation('modules/math/module.ts', 'features/math/index.ts', { kind: 'dynamic' }), null);
});
test('eager page imports and cross-module implementation dependencies fail', () => {
  assert.match(importViolation('modules/a/module.ts', 'features/a/index.ts', { kind: 'static' }), /eagerly/);
  assert.match(importViolation('modules/a/Page.tsx', 'modules/b/private.ts', { kind: 'dynamic' }), /another module/);
  assert.equal(importViolation('modules/a/module.ts', 'modules/contracts.ts', { kind: 'static', typeOnly: true }), null);
});
test('cross-feature private imports and math-to-plugin imports fail', () => {
  assert.match(importViolation('features/a/view.tsx', 'features/b/private.ts', {}), /Cross-feature/);
  assert.equal(importViolation('features/a/view.tsx', 'features/b/index.ts', {}), null);
  assert.match(importViolation('services/math/ode/index.ts', 'modules/index.ts', {}), /Math computation/);
});
test('module infrastructure cannot couple to auth or page implementations', () => {
  assert.match(importViolation('modules/access.ts', 'contexts/AuthContext.tsx', {}), /infrastructure/);
});
test('manifest evaluation disallows eager work but permits lazy entry functions', () => {
  assert.equal(manifestHasEffects('module.ts', "export default { load: () => import('./Page') };"), false);
  for (const source of ["export default getManifest();", "throw new Error('broken');", "export default { get routes() { return []; } };", 'globalThis.changed = true;', 'counter++;', 'delete globalThis.value;']) {
    assert.equal(manifestHasEffects('module.ts', source), true);
  }
});
test('inline type imports and exports do not create runtime edges', () => {
  assert.deepEqual(importsFrom('example.ts', "import { type A } from './a'; export { type B } from './b';").map(i => i.typeOnly), [true, true]);
  assert.equal(importsFrom('example.ts', "import value, { type A } from './a';")[0].typeOnly, false);
});
test('cycle detection finds actual back edges and permits a shared dependency', () => {
  assert.deepEqual(findCycles(new Map([['a', ['b']], ['b', ['a']]])), [['a', 'b', 'a']]);
  assert.deepEqual(findCycles(new Map([['a', ['shared']], ['b', ['shared']], ['shared', []]])), []);
});
