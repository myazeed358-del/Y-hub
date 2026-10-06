import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6B - U-SUBSTITUTION ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const fn = (name: string, args: CanonicalAST[]): CanonicalAST => ({ type: 'Function', name, args });

  it('A) ∫ 2x cos(x²) dx', () => {
    const x2 = op('^', [sym('x'), num('2')]);
    const ast = op('*', [op('*', [num('2'), sym('x')]), fn('cos', [x2])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
    expect(res.substitution).toBeDefined();
    expect(res.substitution?.substitutionVariable).toBe('u');
  });

  it('B) ∫ 3x² e^(x³) dx', () => {
    const x3 = op('^', [sym('x'), num('3')]);
    const ast = op('*', [op('*', [num('3'), op('^', [sym('x'), num('2')])]), fn('exp', [x3])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('C) ∫ (2x)/(x²+1) dx', () => {
    const ast = op('/', [op('*', [num('2'), sym('x')]), op('+', [op('^', [sym('x'), num('2')]), num('1')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect((res.antiderivative as any).name).toBe('ln');
  });

  it('D) ∫ cos(3x+1) dx', () => {
    const u = op('+', [op('*', [num('3'), sym('x')]), num('1')]);
    const ast = fn('cos', [u]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
    expect(res.substitution).toBeDefined();
  });

  it('E) ∫ 2x/(x²+1)² dx', () => {
    const u = op('+', [op('^', [sym('x'), num('2')]), num('1')]);
    const ast = op('/', [op('*', [num('2'), sym('x')]), op('^', [u, num('2')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('F) ∫ (2x)/sqrt(x²+1) dx', () => {
    const u = op('+', [op('^', [sym('x'), num('2')]), num('1')]);
    const ast = op('/', [op('*', [num('2'), sym('x')]), fn('sqrt', [u])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('G) ∫ 5x⁴ / (x⁵+2) dx', () => {
    const u = op('+', [op('^', [sym('x'), num('5')]), num('2')]);
    const ast = op('/', [op('*', [num('5'), op('^', [sym('x'), num('4')])]), u]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
  });

  it('H) ∫ 1/x dx', () => {
    const ast = op('/', [num('1'), sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    // Does not break 1/x -> ln|x|
  });

  it('I) ∫ x sin(x) dx is handled by integration by parts', () => {
    const ast = op('*', [sym('x'), fn('sin', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);

    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
    expect(res.parts?.length).toBeGreaterThan(0);
  });

  it('J) Sub ok but phase 6A unsupported', () => {
    // e.g. ∫ 2x exp(x^4) dx -> let u=x^2 -> du=2x dx -> ∫ exp(u^2) du (unsupported)
    const x2 = op('^', [sym('x'), num('2')]);
    const ast = op('*', [op('*', [num('2'), sym('x')]), fn('exp', [op('^', [x2, num('2')])])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });
});
