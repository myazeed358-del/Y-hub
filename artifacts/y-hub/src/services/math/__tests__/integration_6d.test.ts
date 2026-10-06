import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6D - PARTIAL FRACTIONS ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });

  it('A) ∫ 1/(x(x+1)) dx', () => {
    // 1 / (x^2 + x)
    const den = op('+', [op('^', [sym('x'), num('2')]), sym('x')]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('B) ∫ 3/(x(x-2)) dx', () => {
    // 3 / (x^2 - 2x)
    const den = op('-', [op('^', [sym('x'), num('2')]), op('*', [num('2'), sym('x')])]);
    const ast = op('/', [num('3'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('C) ∫ 1/(x²(x+1)) dx', () => {
    // 1 / (x^3 + x^2)
    const den = op('+', [op('^', [sym('x'), num('3')]), op('^', [sym('x'), num('2')])]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('D) ∫ (x²+1)/(x+1) dx', () => {
    // Division required
    const numAST = op('+', [op('^', [sym('x'), num('2')]), num('1')]);
    const den = op('+', [sym('x'), num('1')]);
    const ast = op('/', [numAST, den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('E) ∫ 1/(x²+1) dx', () => {
    // Delegates to arctan natively
    const den = op('+', [op('^', [sym('x'), num('2')]), num('1')]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('F) Repeated linear factors of higher supported multiplicity', () => {
    // 1 / x^3
    const den = op('^', [sym('x'), num('3')]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect([
      'exactly_equivalent',
      'numerically_consistent'
    ]).toContain(res.verificationStatus);
  });

  it('G) Factorization outside scope', () => {
    // 1 / (x^3 + 2) (no exact rational roots)
    const den = op('+', [op('^', [sym('x'), num('3')]), num('2')]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('H) Domain exclusion is preserved on cancellation', () => {
    // (x²-1)/(x-1) -> simplifies to x+1, but x != 1
    const numAST = op('-', [op('^', [sym('x'), num('2')]), num('1')]);
    const den = op('-', [sym('x'), num('1')]);
    const ast = op('/', [numAST, den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    // Ensure the domain still excludes x=1
    expect(res.domain?.intervals.length).toBeGreaterThan(1);
  });

  it('I) Malformed / non-rational input', () => {
    const ast = op('/', [sym('x'), { type: 'Function', name: 'sin', args: [sym('x')] }]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('J) Resource limits check', () => {
    // 1 / (x^21 - 1)
    const den = op('-', [op('^', [sym('x'), num('21')]), num('1')]);
    const ast = op('/', [num('1'), den]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved'); // hits maxDegree 20
  });
});
