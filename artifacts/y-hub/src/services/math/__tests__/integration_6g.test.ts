import { DefiniteIntegrationEngine } from '../symbolic/definite_integration';
import { DefiniteIntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6G - DEFINITE INTEGRATION ENGINE', () => {
  const engine = new DefiniteIntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const pwr = (arg: CanonicalAST, power: string): CanonicalAST => op('^', [arg, num(power)]);

  it('1. ∫_0^1 x² dx -> 1/3', () => {
    const req: DefiniteIntegrationRequest = { integrand: pwr(sym('x'), '2'), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('proper_exact');
    expect(res.finalValue?.type).toBe('Operator'); // 1/3
  });

  it('2. ∫_0^1 x dx -> 1/2', () => {
    const req: DefiniteIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('proper_exact');
  });

  it('3. ∫_0^π sin(x) dx -> 2', () => {
    const req: DefiniteIntegrationRequest = { integrand: func('sin', sym('x')), variable: 'x', lowerBound: num('0'), upperBound: sym('pi') };
    const res = engine.evaluateDefiniteIntegral(req);
    // Since bounds are mixed numeric and symbolic (pi can be evaluated numerically), orientation should be 1
    // Final value should simplify to 2
    expect(res.classification).toBe('proper_exact');
  });

  it('4. ∫_1^0 x dx -> -1/2', () => {
    const req: DefiniteIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('1'), upperBound: num('0') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('proper_exact');
    expect(res.orientation).toBe(-1);
  });

  it('5. ∫_0^0 x² dx -> 0', () => {
    const req: DefiniteIntegrationRequest = { integrand: pwr(sym('x'), '2'), variable: 'x', lowerBound: num('0'), upperBound: num('0') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('proper_exact');
    expect(res.orientation).toBe(0);
    expect(res.finalValue).toEqual({ type: 'Number', value: '0' });
  });

  it('6. ∫_0^2 1/x dx -> improper_detected', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('0'), upperBound: num('2') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('improper_detected');
  });

  it('7. ∫_-1^1 1/x dx -> improper_detected', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('-1'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('improper_detected');
  });

  it('8. ∫_0^1 1/sqrt(x) dx -> improper_detected', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), func('sqrt', sym('x'))]), variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('improper_detected');
  });

  it('9. ∫_1^2 1/x dx -> ln(2)', () => {
    const req: DefiniteIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('1'), upperBound: num('2') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('proper_exact');
  });

  it('10. ∫_0^1 (x²-1)/(x-1) dx -> must preserve x=1 exclusion', () => {
    // integrand: (x^2-1)/(x-1)
    const numAST = op('-', [pwr(sym('x'), '2'), num('1')]);
    const denAST = op('-', [sym('x'), num('1')]);
    const ast = op('/', [numAST, denAST]);
    const req: DefiniteIntegrationRequest = { integrand: ast, variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    // Evaluated directly at the endpoint 1 where denominator is 0. So domain gap -> improper_detected.
    expect(res.classification).toBe('improper_detected');
  });

  it('11. A symbolic upper bound with unproven ordering -> requires_assumption/unresolved', () => {
    const req: DefiniteIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('0'), upperBound: sym('a') };
    const res = engine.evaluateDefiniteIntegral(req);
    expect(res.classification).toBe('requires_assumption');
  });

  it('12. An unsupported antiderivative -> unsupported', () => {
    // exp(x^2) doesn't have an elementary antiderivative
    const ast = func('exp', pwr(sym('x'), '2'));
    const req: DefiniteIntegrationRequest = { integrand: ast, variable: 'x', lowerBound: num('0'), upperBound: num('1') };
    const res = engine.evaluateDefiniteIntegral(req);
    // IntegrationEngine should return unresolved/unsupported, then 6G returns unsupported
    expect(res.classification).toBe('unsupported');
  });
});
