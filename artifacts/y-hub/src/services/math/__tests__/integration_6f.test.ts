import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 6F - TRIGONOMETRIC SUBSTITUTION ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const sqrt = (arg: CanonicalAST): CanonicalAST => func('sqrt', arg);
  const pwr = (name: string, power: string, arg: CanonicalAST): CanonicalAST => op('^', [func(name, arg), num(power)]);

  it('A) ∫ dx / sqrt(a²-x²) (symbolic a, pos check)', () => {
    // a^2 - x^2 where a is symbolic. Engine doesn't know if 'a' is positive.
    // Must return unresolved/requires_assumption.
    const radical = sqrt(op('-', [op('^', [sym('a'), num('2')]), op('^', [sym('x'), num('2')])]));
    const ast = op('/', [num('1'), radical]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('B) ∫ x / sqrt(4+x²) dx', () => {
    // 4 + x^2 -> a = 2
    const radical = sqrt(op('+', [num('4'), op('^', [sym('x'), num('2')])]));
    const ast = op('/', [sym('x'), radical]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    // Substitution will be x = 2tan(theta). Result should be evaluated by 6E/6B/6A.
    // wait, this is actually matched by general u-sub (u = 4+x^2).
    // The engine runs 6B BEFORE 6F. So 6B will solve it!
    expect(res.status).toBe('exact_symbolic');
  });

  it('C) ∫ sqrt(9-x²) dx', () => {
    const ast = sqrt(op('-', [num('9'), op('^', [sym('x'), num('2')])]));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    // x = 3sin(theta). Transformed: 9 cos^2(theta). Integrable by 6E.
    expect(res.status).toBe('exact_symbolic');
    // Result should not fail verification
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('D) ∫ dx / sqrt(x²-16) preserves branch safety', () => {
    // x = 4sec(theta) gives
    // sqrt(x²-16) = 4|tan(theta)|.
    //
    // Without a branch assumption we must not simplify
    // tan(theta) / |tan(theta)| to 1.
    const radical = sqrt(
      op('-', [
        op('^', [sym('x'), num('2')]),
        num('16')
      ])
    );

    const ast = op('/', [
      num('1'),
      radical
    ]);

    const req: IntegrationRequest = {
      expression: ast,
      variable: 'x'
    };

    const res = engine.integrateRequest(req);

    expect(res.status).toBe('unresolved');

    expect(
      res.steps.some(
        step =>
          step.explanation.includes(
            'sec(theta)'
          )
      )
    ).toBe(true);
  });

  it('E) A case with a known positive numeric a', () => {
    // dx / sqrt(25-x^2) => a=5
    const radical = sqrt(op('-', [num('25'), op('^', [sym('x'), num('2')])]));
    const ast = op('/', [num('1'), radical]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    // 1 / (5 cos(theta)) * 5 cos(theta) dtheta = 1 dtheta = theta = asin(x/5)
    expect(res.status).toBe('exact_symbolic');
  });

  it('F) A case where a is symbolic but positivity is unknown', () => {
    const radical = sqrt(op('-', [op('^', [sym('b'), num('2')]), op('^', [sym('x'), num('2')])]));
    const ast = op('/', [num('1'), radical]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('G) A branch-sensitive sqrt(x²-a²) case', () => {
    const radical = sqrt(op('-', [op('^', [sym('x'), num('2')]), num('4')]));
    const req: IntegrationRequest = { expression: radical, variable: 'x' };
    const res = engine.integrateRequest(req);
    // Transformed: 2|tan(theta)| * 2sec(theta)tan(theta). The |tan(theta)| prevents blind integration, returning unresolved.
    expect(res.status).toBe('unresolved');
  });

  it('H) Transformed theta-integral is outside existing integration capabilities', () => {
    // sqrt(1-x^2) / x^10 -> cos(theta) / sin^10(theta) * cos(theta) = cos^2(theta) / sin^10(theta)
    // 6E limits exponent to 8. So it will return unresolved.
    const radical = sqrt(op('-', [num('1'), op('^', [sym('x'), num('2')])]));
    const ast = op('/', [radical, op('^', [sym('x'), num('10')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('I) Deliberately unsupported shifted radical', () => {
    // sqrt((x-3)^2 - 4)
    // Unrestricted symbolic pattern search should not match it.
    const xMinus3Sq = op('^', [op('-', [sym('x'), num('3')]), num('2')]);
    const radical = sqrt(op('-', [xMinus3Sq, num('4')]));
    const req: IntegrationRequest = { expression: radical, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });
});
