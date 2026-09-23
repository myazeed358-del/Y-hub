import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6C - INTEGRATION BY PARTS ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const fn = (name: string, args: CanonicalAST[]): CanonicalAST => ({ type: 'Function', name, args });

  it('A) ∫ x e^x dx', () => {
    const ast = op('*', [sym('x'), fn('exp', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
    expect(res.parts).toBeDefined();
  });

  it('B) ∫ x sin(x) dx', () => {
    const ast = op('*', [sym('x'), fn('sin', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
    expect(res.parts?.length).toBeGreaterThan(0);
  });

  it('C) ∫ x cos(x) dx', () => {
    const ast = op('*', [sym('x'), fn('cos', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
  });

  it('D) ∫ ln(x) dx', () => {
    const ast = fn('ln', [sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
    expect(res.domain?.intervals.length).toBeGreaterThan(0); // Should have a domain restriction x > 0
  });

  it('E) ∫ x² e^x dx', () => {
    const x2 = op('^', [sym('x'), num('2')]);
    const ast = op('*', [x2, fn('exp', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
  });

  it('F) Should be handled by 6B instead of 6C: ∫ 2x cos(x²) dx', () => {
    const x2 = op('^', [sym('x'), num('2')]);
    const ast = op('*', [op('*', [num('2'), sym('x')]), fn('cos', [x2])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.substitution).toBeDefined();
    expect(res.parts?.length).toBe(0);
  });

  it('G) Unsupported product that cannot be proven through supported Parts rules', () => {
    const ast = op('*', [fn('sin', [sym('x')]), fn('ln', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('H) Variable hygiene with u', () => {
    // ∫ u e^u du
    const ast = op('*', [sym('u'), fn('exp', [sym('u')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'u' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
  });

  it('I) Rational expression simplification erasing denominator', () => {
    // handled correctly implicitly since we do not simplify away original domain constraints
    // (domain analysis runs before anything else)
    const ast = op('/', [op('*', [sym('x'), fn('exp', [sym('x')])]), sym('x')]); 
    // ∫ (x e^x) / x dx 
    // DomainAnalyzer will see x != 0
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    // Result is e^x, but domain restricts x != 0
  });

  it('J) Cyclic protection / recursion protection', () => {
    // ∫ x^5 e^x dx would require depth 5, which exceeds maxDepth 3
    const ast = op('*', [op('^', [sym('x'), num('5')]), fn('exp', [sym('x')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });
});
