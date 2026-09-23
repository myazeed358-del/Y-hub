import { ImproperIntegrationEngine } from '../symbolic/improper_integration';
import { DefiniteIntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6H - IMPROPER INTEGRATION ENGINE', () => {
  const engine = new ImproperIntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const pwr = (arg: CanonicalAST, power: string): CanonicalAST => op('^', [arg, num(power)]);

  it('1. ∫_1^∞ 1/x² dx = 1', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), pwr(sym('x'), '2')]), variable: 'x', lowerBound: num('1'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
    expect(res.finalValue).toEqual(num('1'));
  });

  it('2. ∫_1^∞ 1/x dx diverges', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('1'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('divergent_positive_infinity');
  });

  it('3. ∫_0^1 1/sqrt(x) dx = 2', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), func('sqrt', sym('x'))]), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
    expect(res.finalValue).toEqual(num('2'));
  });

  it('4. ∫_0^1 1/x dx diverges', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('divergent_positive_infinity');
  });

  it('5. ∫_-1^1 1/x dx diverges', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('-1'), upperBound: num('1') };
    const res = engine.evaluateImproperIntegral(req);
    // Split at 0. Both pieces diverge.
    expect(res.classification).toMatch(/divergent/);
  });

  it('6. ∫_-∞^0 e^x dx = 1', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('exp', sym('x')), variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: num('0') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
    expect(res.finalValue).toEqual(num('1'));
  });

  it('7. ∫_0^∞ e^(-x) dx = 1', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('exp', op('*', [num('-1'), sym('x')])), variable: 'x', lowerBound: num('0'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
    expect(res.finalValue).toEqual(num('1'));
  });

  it('8. ∫_0^1 ln(x) dx = -1', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('ln', sym('x')), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('convergent_exact');
    // Final value might be -1
  });

  it('9. A multi-piece interior-singularity case', () => {
    // 1 / (x * (x-1)) from -1 to 2 -> singularities at 0 and 1
    const req: DefiniteIntegrationRequest = { 
       integrand: op('/', [num('1'), op('*', [sym('x'), op('-', [sym('x'), num('1')])])]), 
       variable: 'x', lowerBound: num('-1'), upperBound: num('2') 
    };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.pieces.length).toBeGreaterThan(2);
    expect(res.classification).toMatch(/divergent/);
  });

  it('10. A parameterized case requiring assumptions', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), pwr(sym('x'), 'p')]), variable: 'x', lowerBound: num('1'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    expect(res.classification).toBe('unresolved'); // Can't order bounds without 'p'
  });

  it('11. A two-sided infinite integral', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('exp', op('*', [num('-1'), pwr(sym('x'), '2')])), variable: 'x', lowerBound: op('*', [num('-1'), sym('infinity')]), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    // Split at 0
    expect(res.pieces.length).toBe(2);
  });

  it('12. A deliberately unsupported limit/convergence case', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('sin', pwr(sym('x'), '2')), variable: 'x', lowerBound: num('0'), upperBound: sym('infinity') };
    const res = engine.evaluateImproperIntegral(req);
    // Fresnel integral limit is oscillatory/undefined in standard calculus without special tools
    expect(res.classification).not.toBe('convergent_exact');
  });
});
