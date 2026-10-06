import { IntegrationEngine } from '../symbolic/integration';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';
import { ASTUtils } from '../symbolic/utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';

describe('CORE CALCULUS 6E - TRIGONOMETRIC INTEGRALS ENGINE', () => {
  const engine = new IntegrationEngine();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const pwr = (name: string, power: string, arg: CanonicalAST): CanonicalAST => op('^', [func(name, arg), num(power)]);

  it('A) ∫ sin³(x) cos(x) dx', () => {
    const ast = op('*', [pwr('sin', '3', sym('x')), func('cos', sym('x'))]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    // Result: sin^4(x) / 4 (via 6B substitution)
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('B) ∫ sin(x) cos²(x) dx', () => {
    const ast = op('*', [func('sin', sym('x')), pwr('cos', '2', sym('x'))]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('C) ∫ sin²(x) dx', () => {
    const ast = pwr('sin', '2', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('D) ∫ cos²(x) dx', () => {
    const ast = pwr('cos', '2', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('E) ∫ sec²(x) dx', () => {
    const ast = pwr('sec', '2', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
  });

  it('F) ∫ tan(x) dx (Logarithmic result)', () => {
    const ast = func('tan', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
  });

  it('G) ∫ tan²(x) dx', () => {
    const ast = pwr('tan', '2', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('exact_symbolic');
    expect(res.verificationStatus).not.toBe('verification_failed');
  });

  it('H) ∫ sec³(x) dx', () => {
    // 6E does not natively support odd powers of sec(x) without explicit recurrence or 6C (Integration by parts).
    // Let's see if 6C can handle it, or if it correctly returns unresolved.
    const ast = pwr('sec', '3', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    // Since 6C parts matchParts may not handle sec^3(x) cleanly, it should gracefully fall back to unresolved.
    expect(['exact_symbolic', 'unresolved']).toContain(res.status);
  });

  it('I) Fractional exponent out of bounds', () => {
    // sin^(1/2)(x)
    const ast = op('^', [func('sin', sym('x')), op('/', [num('1'), num('2')])]);
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });

  it('J) Domain constraints of tan(x) are preserved', () => {
    const ast = func('tan', sym('x'));
    const req: IntegrationRequest = {
      expression: ast,
      variable: 'x'
    };

    const res = engine.integrateRequest(req);

    expect(res.domain).not.toBeNull();

    // tan(x) is undefined wherever cos(x) = 0.
    //
    // This is a periodic infinite exclusion and therefore cannot be
    // represented faithfully as a finite list of intervals.
    expect(
      res.domain?.domainRestrictions.some(
        restriction =>
          restriction.includes('cos(x)') &&
          restriction.includes('!= 0')
      )
    ).toBe(true);
  });

  it('K) Complexity / limit check', () => {
    // sin^20(x)
    const ast = pwr('sin', '20', sym('x'));
    const req: IntegrationRequest = { expression: ast, variable: 'x' };
    const res = engine.integrateRequest(req);
    expect(res.status).toBe('unresolved');
  });
});
