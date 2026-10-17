import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'artifacts/y-hub/src');
const normalize = path => path.replaceAll('\\', '/');

export function importsFrom(source, text) {
  const ast = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true,
    source.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : node;
      const bindings = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
      const typeOnly = Boolean(clause?.isTypeOnly ||
        (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
         bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly) &&
         !(ts.isImportDeclaration(node) && clause?.name)));
      imports.push({ specifier: node.moduleSpecifier.text, kind: 'static', typeOnly });
    }
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const specifier = node.arguments[0].text;
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        imports.push({ specifier, kind: 'dynamic', typeOnly: false });
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        imports.push({ specifier, kind: 'static', typeOnly: false });
      }
      if (node.expression.getText(ast) === 'import.meta.glob') {
        imports.push({ specifier, kind: 'glob', typeOnly: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return imports;
}

export function importViolation(source, target, dependency) {
  const from = normalize(source).split('/');
  const to = normalize(target).split('/');
  const moduleOwner = parts => parts[0] === 'modules' && parts.length > 2 ? parts[1] : null;
  const sourceModule = moduleOwner(from), targetModule = moduleOwner(to);
  if (source.endsWith('/module.ts') && dependency.kind === 'static' && !dependency.typeOnly) {
    return 'Manifest metadata must not eagerly import runtime implementations';
  }
  if (sourceModule && targetModule && sourceModule !== targetModule) {
    return 'Module must not import another module implementation';
  }
  if (from[0] === 'modules' && to[0] === 'features' && (to.length !== 3 || to[2] !== 'index.ts')) {
    return 'Module entry must use the feature public index';
  }
  if (from[0] === 'modules' && from.length === 2 && ['features', 'pages', 'contexts'].includes(to[0])) {
    return 'Module infrastructure must not depend on application feature/auth implementation';
  }
  if (from[0] === 'features' && to[0] === 'features' && from[1] !== to[1] &&
      (to.length !== 3 || to[2] !== 'index.ts')) {
    return 'Cross-feature private import';
  }
  if (from[0] === 'services' && from[1] === 'math' && to[0] === 'modules') {
    return 'Math computation must not depend on UI module composition';
  }
  return null;
}

export function manifestHasEffects(source, text) {
  const ast = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
  let effect = false;
  const inspect = node => {
    // Lazy loaders run later; only metadata evaluation is checked.
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return;
    if (ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isThrowStatement(node) ||
        ts.isAwaitExpression(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) ||
        ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isDeleteExpression(node) ||
        ts.isPostfixUnaryExpression(node) ||
        (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
         node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)) effect = true;
    ts.forEachChild(node, inspect);
  };
  for (const statement of ast.statements) inspect(statement);
  return effect;
}

export function findCycles(graph) {
  const active = new Set(), visited = new Set(), cycles = [];
  function visit(node, path) {
    if (active.has(node)) { cycles.push([...path.slice(path.indexOf(node)), node]); return; }
    if (visited.has(node)) return;
    active.add(node);
    for (const target of graph.get(node) ?? []) visit(target, [...path, node]);
    active.delete(node); visited.add(node);
  }
  for (const node of graph.keys()) visit(node, []);
  return cycles;
}

export function inspectProject() {
  const configPath = resolve(root, 'artifacts/y-hub/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  if (parsed.errors.length) throw new Error('Cannot parse project TypeScript configuration');
  const files = parsed.fileNames.filter(path => !/(__tests__|\.(?:test|spec)\.|\.d\.ts$)/.test(path));
  const known = new Set(files.map(resolvePath => resolve(resolvePath)));
  const graph = new Map(files.map(path => [normalize(relative(sourceRoot, path)), new Set()]));
  const issues = [];
  const cache = ts.createModuleResolutionCache(root, path => path, parsed.options);
  for (const file of files) {
    const source = normalize(relative(sourceRoot, file));
    // TypeScript's host handles UTF-16 source files as well as UTF-8.
    const text = ts.sys.readFile(file);
    if (text === undefined) throw new Error('Unreadable source: ' + source);
    if (basename(file) === 'module.ts' && manifestHasEffects(file, text)) {
      issues.push(source + ': metadata has eager side effects');
    }
    for (const dependency of importsFrom(file, text)) {
      if (dependency.kind === 'glob') {
        if (source !== 'modules/discovery.ts' || dependency.specifier !== './*/module.ts') {
          issues.push(source + ': review unsupported discovery pattern ' + dependency.specifier);
        } else {
          for (const entry of readdirSync(dirname(file), { withFileTypes: true })) {
            const candidate = resolve(dirname(file), entry.name, 'module.ts');
            if (entry.isDirectory() && known.has(candidate)) graph.get(source).add(normalize(relative(sourceRoot, candidate)));
          }
        }
        continue;
      }
      const targetFile = ts.resolveModuleName(dependency.specifier, file, parsed.options, ts.sys, cache)
        .resolvedModule?.resolvedFileName;
      const target = targetFile ? normalize(relative(sourceRoot, targetFile)) : dependency.specifier;
      const issue = importViolation(source, target, dependency);
      if (issue) issues.push(source + ' -> ' + dependency.specifier + ': ' + issue);
      if (targetFile && known.has(resolve(targetFile)) && dependency.kind === 'static' && !dependency.typeOnly) {
        graph.get(source).add(target);
      }
    }
  }
  for (const cycle of findCycles(graph)) issues.push('Runtime import cycle: ' + cycle.join(' -> '));
  return { files: files.length, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inspectProject();
  for (const issue of result.issues) console.error(issue);
  console.log(result.issues.length ? 'FAIL: module boundaries' : 'PASS: module/public-feature boundaries and static runtime cycles (' + result.files + ' files)');
  process.exitCode = result.issues.length ? 1 : 0;
}
