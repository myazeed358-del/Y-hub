import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const FEATURE = join(SRC, 'features/app-shell');
const LAYOUT = join(SRC, 'components/layout');

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
      const value = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = value;
    }

    return swapped.toString('utf16le');
  }

  return bytes.toString('utf8').replace(/^\uFEFF/, '');
}

function importedPaths(path: string): string[] {
  const regex =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

  return Array.from(
    readSource(path).matchAll(regex),
    (match) => match[1] ?? ''
  );
}

function display(path: string): string {
  return relative(SRC, path).split(sep).join('/');
}

function inside(path: string, directory: string): boolean {
  return path.startsWith(directory + sep);
}

const production = productionFiles(SRC);
const layoutFiles = productionFiles(LAYOUT);
const featureFiles = productionFiles(FEATURE);

const expectedFacades = [
  'AppHeader.tsx',
  'AppShell.tsx',
  'AppSidebar.tsx',
  'ApplicationFrame.tsx',
  'SidebarAccountCard.tsx',
  'SidebarEngineSearch.tsx',
  'SidebarLessonPath.tsx',
  'SidebarNavigation.tsx',
  'navigation.ts',
].sort();

describe('ArchitectureBoundaries', () => {
  it('preserves the nine legacy layout facades', () => {
    // Explicit callback prevents the array index
    // from being passed as basename's suffix argument.
    expect(
      layoutFiles.map((path) => basename(path)).sort()
    ).toEqual(expectedFacades);
  });

  it('keeps layout files as re-exports only', () => {
    const violations = layoutFiles.filter((path) => {
      const source = readSource(path).trim();

      return !/^export\s+(?:\*|\{[^}]+\})\s+from\s+['"][^'"]+['"];?$/.test(
        source
      );
    });

    expect(violations.map(display)).toEqual([]);
  });

  it('prevents app-shell from importing legacy layout', () => {
    const violations = featureFiles.flatMap((path) =>
      importedPaths(path)
        .filter((target) =>
          target.startsWith('@/components/layout/')
        )
        .map((target) => `${display(path)} -> ${target}`)
    );

    expect(violations).toEqual([]);
  });

  it('prevents external production deep imports', () => {
    const violations = production
      .filter((path) =>
        !inside(path, FEATURE) &&
        !inside(path, LAYOUT)
      )
      .flatMap((path) =>
        importedPaths(path)
          .filter((target) =>
            target.startsWith('@/features/app-shell/')
          )
          .map((target) => `${display(path)} -> ${target}`)
      );

    expect(violations).toEqual([]);
  });

  it('prevents production use of legacy AppShell imports', () => {
    const violations = production.filter((path) =>
      importedPaths(path).includes(
        '@/components/layout/AppShell'
      )
    );

    expect(violations.map(display)).toEqual([]);
  });

  it('prevents production use of legacy ApplicationFrame imports', () => {
    const violations = production.filter((path) =>
      importedPaths(path).includes(
        '@/components/layout/ApplicationFrame'
      )
    );

    expect(violations.map(display)).toEqual([]);
  });

  it('preserves the public API and compatibility facades', () => {
    const publicApi = readSource(
      join(FEATURE, 'index.ts')
    ).trim();

    const shellFacade = readSource(
      join(LAYOUT, 'AppShell.tsx')
    ).trim();

    const frameFacade = readSource(
      join(LAYOUT, 'ApplicationFrame.tsx')
    ).trim();

    expect(publicApi).toBe(
      "export { AppShell } from './components/AppShellController';"
    );

    expect(shellFacade).toBe(
      "export { AppShell } from '@/features/app-shell';"
    );

    expect(frameFacade).toBe(
      "export { ApplicationFrame } from '@/app/ApplicationFrame';"
    );
  });

  it('keeps application integration on public paths', () => {
    const appImports = importedPaths(
      join(SRC, 'App.tsx')
    );

    const frameImports = importedPaths(
      join(SRC, 'app/ApplicationFrame.tsx')
    );

    expect(appImports).toContain(
      '@/app/ApplicationFrame'
    );

    expect(appImports).not.toContain(
      '@/components/layout/ApplicationFrame'
    );

    expect(frameImports).toContain(
      '@/features/app-shell'
    );

    expect(
      frameImports.filter((target) =>
        target.startsWith('@/features/app-shell/')
      )
    ).toEqual([]);

    expect(frameImports).not.toContain(
      '@/components/layout/AppShell'
    );
  });
});
