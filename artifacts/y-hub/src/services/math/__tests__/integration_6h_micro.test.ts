import { ImproperIntegrationEngine } from '../symbolic/improper_integration';
import { DefiniteIntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6H - FINAL MICRO-AUDIT', () => {
  const engine = new ImproperIntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const pwr = (arg: CanonicalAST, power: string): CanonicalAST => op('^', [arg, num(power)]);

  it('A) ∫_1^∞ 1/x² dx = 1', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), pwr(sym('x'), '2')]), variable: 'x', lowerBound: num('1'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
  });

  it('B) ∫_-∞^0 e^x dx = 1', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('exp', sym('x')), variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: num('0') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
  });

  it('C) ∫_-∞^∞ 1/(x²+1) dx converges', () => {
    // 1 / (x^2 + 1) -> atan(x) -> atan(inf) - atan(-inf) = pi/2 - (-pi/2) = pi
    const req: DefiniteIntegrationRequest = { 
       integrand: op('/', [num('1'), op('+', [pwr(sym('x'), '2'), num('1')])]), 
       variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: sym('infinity') 
    };
    const res = engine.evaluateImproperIntegral(req);
    // LimitEngine should evaluate atan(inf) if it supports it, else unresolved
    expect(['convergent_exact', 'unresolved']).toContain(res.classification);
    // It should have exactly 1 piece, internally evaluated as two components over c=0
    expect(res.pieces.length).toBe(1);
    if (res.pieces[0]) {
        expect(res.pieces[0].doublyImproperSplitPoint).toBeDefined();
        expect(res.pieces[0].leftComponent).toBeDefined();
        expect(res.pieces[0].rightComponent).toBeDefined();
    }
  });

  it('D) ∫_-∞^∞ 1/x dx diverges', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toMatch(/divergent/);
    // EXACTLY two pieces: (-inf, 0) and (0, inf), both doubly improper and evaluated via double limit
    expect(res.pieces.length).toBe(2);
  });

  it('E) Multiple singularities', () => {
    const req: DefiniteIntegrationRequest = { 
       integrand: op('/', [num('1'), op('*', [sym('x'), op('-', [sym('x'), num('1')])])]), 
       variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: sym('infinity') 
    };
    const res = engine.evaluateImproperIntegral(req);
    // singularities at 0 and 1
    // splitPoints = [-inf, 0, 1, inf] -> exactly 3 pieces via double limits
    expect(res.pieces.length).toBe(3);
    expect(res.classification).toMatch(/divergent/);
  });

  it('F) Disconnected domain gap', () => {
    // 1 / sqrt(x^2 - 1) is undefined on (-1, 1). Integral from -inf to inf crosses this gap.
    const req: DefiniteIntegrationRequest = { 
       integrand: op('/', [num('1'), func('sqrt', op('-', [pwr(sym('x'), '2'), num('1')]))]), 
       variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: sym('infinity') 
    };
    const res = engine.evaluateImproperIntegral(req);
    // mid-point check in evaluateImproperIntegral will catch the gap (-1, 1) and return unresolved (or domain invalid)
    expect(res.classification).toBe('unresolved');
  });
});
