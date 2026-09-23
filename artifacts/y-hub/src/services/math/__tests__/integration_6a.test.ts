import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6A - INTEGRATION ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const fn = (name: string, args: CanonicalAST[]): CanonicalAST => ({ type: 'Function', name, args });

  it('A) ∫x² dx → x³/3', () => {
    const ast = op('^', [sym('x'), num('2')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
    expect(res.antiderivative?.type).toBe('Operator');
  });

  it('B) ∫5x⁴ dx → x⁵', () => {
    const ast = op('*', [num('5'), op('^', [sym('x'), num('4')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
  });

  it('C) ∫(x²+3x-4) dx', () => {
    const ast = op('+', [
       op('^', [sym('x'), num('2')]),
       op('*', [num('3'), sym('x')]),
       num('-4')
    ]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).toBe('exactly_equivalent');
  });

  it('D) ∫1/x dx → ln|x|', () => {
    const ast = op('/', [num('1'), sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.antiderivative?.type).toBe('Function');
    expect((res.antiderivative as any).name).toBe('ln');
  });

  it('E) ∫cos(x) dx → sin(x)', () => {
    const ast = fn('cos', [sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect((res.antiderivative as any).name).toBe('sin');
  });

  it('F) ∫sin(x) dx → -cos(x)', () => {
    const ast = fn('sin', [sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
  });

  it('G) ∫e^x dx → e^x', () => {
    const ast = fn('exp', [sym('x')]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
  });

  it('H) ∫(2x)/(x²+1) dx → ln(x²+1)', () => {
    const numAst = op('*', [num('2'), sym('x')]);
    const denAst = op('+', [op('^', [sym('x'), num('2')]), num('1')]);
    const ast = op('/', [numAst, denAst]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect((res.antiderivative as any).name).toBe('ln');
  });

  it('I) ∫cos(x²)·2x dx → sin(x²)', () => {
    const x2 = op('^', [sym('x'), num('2')]);
    const cosX2 = fn('cos', [x2]);
    const twoX = op('*', [num('2'), sym('x')]);
    const ast = op('*', [cosX2, twoX]);
    
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect((res.antiderivative as any).name).toBe('sin');
  });

  it('J) unsupported/nontrivial integral', () => {
    const ast = fn('exp', [op('^', [sym('x'), num('2')])]); // e^(x^2)
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
    expect(res.antiderivative).toBeNull();
  });
});
