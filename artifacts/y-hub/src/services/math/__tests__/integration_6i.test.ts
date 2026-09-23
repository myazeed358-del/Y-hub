import { NumericalIntegrationEngine } from '../symbolic/numerical_integration';
import { NumericalIntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6I - NUMERICAL INTEGRATION', () => {
  const engine = new NumericalIntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const pwr = (arg: CanonicalAST, power: string): CanonicalAST => op('^', [arg, num(power)]);

  it('A) ∫_0^1 x² dx (Composite Simpson)', () => {
    const req: NumericalIntegrationRequest = { integrand: pwr(sym('x'), '2'), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'simpson', subdivisions: 100 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('converged');
    expect(res.numericalValue).toBeCloseTo(1/3, 15);
  });

  it('B) ∫_0^1 x² dx (Composite Trapezoidal)', () => {
    const req: NumericalIntegrationRequest = { integrand: pwr(sym('x'), '2'), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'trapezoidal', subdivisions: 1000 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('converged');
    expect(res.numericalValue).toBeCloseTo(1/3, 5); // Trap is less accurate than Simpson, but converges
  });

  it('C) ∫_0^π sin(x)dx', () => {
    const req: NumericalIntegrationRequest = { integrand: func('sin', sym('x')), variable: 'x', lowerBound: num('0'), upperBound: sym('pi'), method: 'adaptive_simpson', tolerance: 1e-8 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('converged');
    expect(res.numericalValue).toBeCloseTo(2, 8);
  });

  it('D) ∫_0^1 e^(-x²)dx (Adaptive Simpson)', () => {
    const req: NumericalIntegrationRequest = { integrand: func('exp', op('*', [num('-1'), pwr(sym('x'), '2')])), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'adaptive_simpson', tolerance: 1e-10 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('converged');
    // Erf(1)*sqrt(pi)/2 ≈ 0.746824132812427
    expect(res.numericalValue).toBeCloseTo(0.7468241328, 9);
  });

  it('E) Reversed interval: ∫_1^0 x dx', () => {
    const req: NumericalIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('1'), upperBound: num('0'), method: 'trapezoidal', subdivisions: 10 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('converged');
    expect(res.orientation).toBe(-1);
    expect(res.numericalValue).toBeCloseTo(-0.5, 10);
  });

  it('F) Tolerance validation', () => {
    const req: NumericalIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'adaptive_simpson', tolerance: -0.01 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('invalid_tolerance');
  });

  it('G) Simpson with odd n', () => {
    const req: NumericalIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'simpson', subdivisions: 11 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('requires_even_subdivision_count');
  });

  it('H) ∫_0^1 1/x dx', () => {
    const req: NumericalIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'adaptive_simpson' };
    const res = engine.evaluateNumericalIntegral(req);
    expect(['endpoint_singularity', 'requires_improper', 'singularity_detected']).toContain(res.classification);
  });

  it('I) ∫_-1^1 1/x dx', () => {
    const req: NumericalIntegrationRequest = { integrand: op('/', [num('1'), sym('x')]), variable: 'x', lowerBound: num('-1'), upperBound: num('1'), method: 'adaptive_simpson' };
    const res = engine.evaluateNumericalIntegral(req);
    expect(['singularity_detected', 'requires_improper']).toContain(res.classification);
  });

  it('J) ∫_0^1 1/sqrt(x)dx', () => {
    const req: NumericalIntegrationRequest = { integrand: op('/', [num('1'), func('sqrt', sym('x'))]), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'adaptive_simpson' };
    const res = engine.evaluateNumericalIntegral(req);
    expect(['endpoint_singularity', 'requires_improper', 'singularity_detected']).toContain(res.classification);
  });

  it('K) (x²-1)/(x-1) on [0,2] (removable gap)', () => {
    // f(x) = (x^2 - 1) / (x - 1)
    const integrand = op('/', [op('-', [pwr(sym('x'), '2'), num('1')]), op('-', [sym('x'), num('1')])]);
    const req: NumericalIntegrationRequest = { integrand, variable: 'x', lowerBound: num('0'), upperBound: num('2'), method: 'adaptive_simpson' };
    const res = engine.evaluateNumericalIntegral(req);
    // DomainAnalyzer will see x-1 != 0 => x != 1, which is inside [0,2]
    expect(res.classification).toBe('singularity_detected');
  });

  it('L) Function producing NaN', () => {
    // sqrt(-1) evaluates to NaN for x=0 if not caught by domain analyzer
    // we use a tricky structure to bypass analyzer and force evaluator to fail
    const trickyAst = { type: 'Function', name: 'sqrt', args: [num('-1')] };
    const req: NumericalIntegrationRequest = { integrand: trickyAst as CanonicalAST, variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'trapezoidal' };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('non_finite_evaluation');
  });

  it('N) Resource limit (max evaluations)', () => {
    // By setting maxEvaluations low, it will trip immediately
    const req: NumericalIntegrationRequest = { integrand: sym('x'), variable: 'x', lowerBound: num('0'), upperBound: num('1'), method: 'trapezoidal', subdivisions: 100, maxEvaluations: 50 };
    const res = engine.evaluateNumericalIntegral(req);
    expect(res.classification).toBe('resource_limit');
  });
});
