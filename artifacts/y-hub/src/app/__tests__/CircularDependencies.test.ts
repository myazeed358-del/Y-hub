import {
  readFileSync,
  readdirSync,
} from 'node:fs';

import {
  dirname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import * as ts from 'typescript';

import {
  describe,
  expect,
  it,
} from 'vitest';

type Graph = Map<string, Set<string>>;

const SRC = resolve(process.cwd(), 'src');
const FEATURE = join(SRC, 'features/app-shell');
const APP = join(SRC, 'app');

function productionFiles(directory: string): string[] {
  const result: string[] = [];

  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === 'node_modules'
      ) {
        continue;
      }

      result.push(...productionFiles(path));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.d\.ts$/.test(entry.name)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;

    result.push(path);
  }

  return result.sort();
}

function readSource(path: string): string {
  const bytes = readFileSync(path);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));

    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const first = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = first;
    }

    return swapped.toString('utf16le');
  }

  return bytes.toString('utf8').replace(/^\uFEFF/, '');
}

function runtimeSpecifiers(source: string): string[] {
  const file = ts.createSourceFile(
    'architecture-audit.tsx',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );

  const specs: string[] = [];

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;

      if (clause?.isTypeOnly) continue;

      if (
        clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0 &&
        clause.namedBindings.elements.every(
          (element) => element.isTypeOnly
        )
      ) {
        continue;
      }

      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        specs.push(statement.moduleSpecifier.text);
      }
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;

      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.exportClause.elements.every(
          (element) => element.isTypeOnly
        )
      ) {
        continue;
      }

      if (
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        specs.push(statement.moduleSpecifier.text);
      }
    }

    if (ts.isImportEqualsDeclaration(statement)) {
      if (statement.isTypeOnly) continue;

      if (
        ts.isExternalModuleReference(statement.moduleReference) &&
        statement.moduleReference.expression &&
        ts.isStringLiteral(statement.moduleReference.expression)
      ) {
        specs.push(statement.moduleReference.expression.text);
      }
    }
  }

  // Literal CommonJS require calls are synchronous.
  // Dynamic import() calls are intentionally excluded.
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(file);

  return specs;
}

function resolveLocal(
  origin: string,
  spec: string,
  available: Set<string>
): string | null {
  let base: string;

  if (spec.startsWith('@/')) {
    base = resolve(SRC, spec.slice(2));
  } else if (
    spec.startsWith('./') ||
    spec.startsWith('../')
  ) {
    base = resolve(dirname(origin), spec);
  } else {
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];

  if (base.endsWith('.js')) {
    candidates.push(
      `${base.slice(0, -3)}.ts`,
      `${base.slice(0, -3)}.tsx`
    );
  }

  for (const candidate of candidates) {
    if (available.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildGraph(): Graph {
  const paths = productionFiles(SRC);
  const available = new Set(paths);

  const graph: Graph = new Map(
    paths.map((path) => [path, new Set<string>()])
  );

  for (const path of paths) {
    const specs = runtimeSpecifiers(readSource(path));

    for (const spec of specs) {
      const target = resolveLocal(path, spec, available);

      if (target) {
        graph.get(path)!.add(target);
      }
    }
  }

  return graph;
}

function cycleGroups(graph: Graph): string[][] {
  let index = 0;

  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  function visit(node: string): void {
    indices.set(node, index);
    low.set(node, index);
    index++;

    stack.push(node);
    onStack.add(node);

    for (const target of graph.get(node) ?? []) {
      if (!indices.has(target)) {
        visit(target);

        low.set(
          node,
          Math.min(
            low.get(node)!,
            low.get(target)!
          )
        );
      } else if (onStack.has(target)) {
        low.set(
          node,
          Math.min(
            low.get(node)!,
            indices.get(target)!
          )
        );
      }
    }

    if (low.get(node) === indices.get(node)) {
      const group: string[] = [];

      while (stack.length > 0) {
        const item = stack.pop()!;
        onStack.delete(item);
        group.push(item);

        if (item === node) break;
      }

      if (
        group.length > 1 ||
        graph.get(node)?.has(node)
      ) {
        cycles.push(group.sort());
      }
    }
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) {
      visit(node);
    }
  }

  return cycles.sort((a, b) =>
    a[0].localeCompare(b[0])
  );
}

function inside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(folder + sep);
}

function display(path: string): string {
  return relative(SRC, path).split(sep).join('/');
}

function readableCycles(groups: string[][]): string[][] {
  return groups.map((group) => group.map(display));
}

const graph = buildGraph();
const cycles = cycleGroups(graph);

describe('CircularDependencies', () => {
  it('detects a two-module circular dependency', () => {
    const example: Graph = new Map([
      ['A', new Set(['B'])],
      ['B', new Set(['A'])],
    ]);

    expect(cycleGroups(example))
      .toEqual([['A', 'B']]);
  });

  it('detects direct self-dependencies', () => {
    const example: Graph = new Map([
      ['A', new Set(['A'])],
    ]);

    expect(cycleGroups(example))
      .toEqual([['A']]);
  });

  it('excludes type-only and dynamic imports', () => {
    const example = `
      import type { One } from './one';
      import { type Two } from './two';
      export type { Three } from './three';
      export { type Four } from './four';
      import('./dynamic');
      import { Runtime } from './runtime';
      export { value } from './public';
      require('./commonjs');
    `;

    expect(runtimeSpecifiers(example).sort())
      .toEqual([
        './commonjs',
        './public',
        './runtime',
      ]);
  });

  it('resolves ApplicationFrame to the app-shell public API', () => {
    const frame = join(SRC, 'app/ApplicationFrame.tsx');
    const publicApi = join(FEATURE, 'index.ts');

    expect(graph.get(frame)?.has(publicApi))
      .toBe(true);
  });

  it('resolves the public API to AppShellController', () => {
    const publicApi = join(FEATURE, 'index.ts');
    const controller = join(
      FEATURE,
      'components/AppShellController.tsx'
    );

    expect(graph.get(publicApi)?.has(controller))
      .toBe(true);
  });

  it('prevents circular dependencies inside app-shell', () => {
    const violations = cycles.filter((group) =>
      group.every((path) => inside(path, FEATURE))
    );

    expect(readableCycles(violations))
      .toEqual([]);
  });

  it('prevents circular dependencies touching app-shell or app', () => {
    const violations = cycles.filter((group) =>
      group.some((path) =>
        inside(path, FEATURE) ||
        inside(path, APP)
      )
    );

    expect(readableCycles(violations))
      .toEqual([]);
  });
});
