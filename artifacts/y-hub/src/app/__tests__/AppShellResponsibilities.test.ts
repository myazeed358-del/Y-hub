import {
  readFileSync,
  readdirSync,
} from 'node:fs';

import {
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

const SRC = resolve(process.cwd(), 'src');
const FEATURE = join(SRC, 'features/app-shell');

interface Dependency {
  file: string;
  specifier: string;
  typeOnly: boolean;
}

function sourceFiles(directory: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    const full = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === 'node_modules'
      ) {
        continue;
      }

      results.push(...sourceFiles(full));
      continue;
    }

    if (!entry.isFile()) continue;

    if (!/\.tsx?$/.test(entry.name)) continue;

    if (
      /\.d\.ts$/.test(entry.name) ||
      /\.(test|spec)\.tsx?$/.test(entry.name)
    ) {
      continue;
    }

    results.push(full);
  }

  return results.sort();
}

function readSource(file: string): string {
  const bytes = readFileSync(file);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const copy = Buffer.from(bytes.subarray(2));
    copy.swap16();
    return copy.toString('utf16le');
  }

  return bytes.toString('utf8').replace(/^\uFEFF/, '');
}

function fileName(file: string): string {
  return relative(SRC, file).split(sep).join('/');
}

function extractDependencies(file: string): Dependency[] {
  const ast = ts.createSourceFile(
    file,
    readSource(file),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  const dependencies: Dependency[] = [];

  function add(
    specifier: string,
    typeOnly = false
  ): void {
    dependencies.push({
      file: fileName(file),
      specifier,
      typeOnly,
    });
  }

  for (const statement of ast.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.importClause;

      let typeOnly = clause?.isTypeOnly ?? false;

      if (
        clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0 &&
        clause.namedBindings.elements.every(
          (item) => item.isTypeOnly
        )
      ) {
        typeOnly = true;
      }

      add(statement.moduleSpecifier.text, typeOnly);
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      let typeOnly = statement.isTypeOnly;

      if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.exportClause.elements.every(
          (item) => item.isTypeOnly
        )
      ) {
        typeOnly = true;
      }

      add(statement.moduleSpecifier.text, typeOnly);
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      add(
        statement.moduleReference.expression.text,
        statement.isTypeOnly
      );
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const isRequire =
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require';

      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;

      if (isRequire || isDynamicImport) {
        add(node.arguments[0].text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);

  return dependencies;
}

const featureFiles = sourceFiles(FEATURE);

const dependencies = featureFiles.flatMap(
  extractDependencies
);

function violations(
  predicate: (item: Dependency) => boolean
): string[] {
  return dependencies
    .filter(predicate)
    .map(
      (item) =>
        `${item.file} -> ${item.specifier}`
    )
    .sort();
}

describe('AppShellResponsibilities', () => {
  it('keeps AuthContext access in the controller only', () => {
    const consumers = dependencies
      .filter(
        (item) =>
          item.specifier === '@/contexts/AuthContext'
      )
      .map((item) => item.file)
      .sort();

    expect(consumers).toEqual([
      'features/app-shell/components/AppShellController.tsx',
    ]);
  });

  it('prevents direct Supabase dependencies', () => {
    expect(
      violations((item) =>
        item.specifier.toLowerCase().includes('supabase')
      )
    ).toEqual([]);
  });

  it('prevents imports from app, pages and routing layers', () => {
    const forbidden = [
      '@/app/',
      '@/pages/',
      '@/routing/',
      '@/components/layout/',
    ];

    expect(
      violations((item) =>
        forbidden.some((prefix) =>
          item.specifier.startsWith(prefix)
        )
      )
    ).toEqual([]);
  });

  it('keeps AppShellView independent of data sources', () => {
    const forbidden = [
      '@/contexts/',
      '@/services/',
      '@/utils/',
      '@/content/',
      '@/config/',
      '@/app/',
      '@/pages/',
      '@/routing/',
    ];

    expect(
      violations((item) =>
        item.file ===
          'features/app-shell/components/AppShellView.tsx' &&
        forbidden.some((prefix) =>
          item.specifier.startsWith(prefix)
        )
      )
    ).toEqual([]);
  });

  it('keeps header and sidebar components away from data access', () => {
    const forbidden = [
      '@/contexts/',
      '@/services/',
      '@/utils/courseStorage',
      '@/app/',
      '@/pages/',
      '@/routing/',
    ];

    expect(
      violations((item) => {
        const isPresentation =
          item.file.startsWith(
            'features/app-shell/components/header/'
          ) ||
          item.file.startsWith(
            'features/app-shell/components/sidebar/'
          );

        return (
          isPresentation &&
          forbidden.some((prefix) =>
            item.specifier.startsWith(prefix)
          )
        );
      })
    ).toEqual([]);
  });

  it('keeps domain modules independent of React and application state', () => {
    const forbidden = [
      'react',
      'react-dom',
      'wouter',
      '@/contexts/',
      '@/services/',
      '@/utils/courseStorage',
      '@/app/',
      '@/pages/',
      '@/routing/',
    ];

    expect(
      violations((item) =>
        item.file.startsWith(
          'features/app-shell/domain/'
        ) &&
        forbidden.some(
          (specifier) =>
            item.specifier === specifier ||
            item.specifier.startsWith(specifier + '/')
        )
      )
    ).toEqual([]);
  });

  it('limits courseStorage access to useActiveCourseName', () => {
    const consumers = dependencies
      .filter(
        (item) =>
          item.specifier === '@/utils/courseStorage'
      )
      .map((item) => item.file)
      .sort();

    expect(consumers).toEqual([
      'features/app-shell/hooks/useActiveCourseName.ts',
    ]);
  });

  it('keeps domain localization imports type-only', () => {
    expect(
      violations((item) =>
        item.file.startsWith(
          'features/app-shell/domain/'
        ) &&
        item.specifier.startsWith('@/i18n/') &&
        !item.typeOnly
      )
    ).toEqual([]);
  });
});
