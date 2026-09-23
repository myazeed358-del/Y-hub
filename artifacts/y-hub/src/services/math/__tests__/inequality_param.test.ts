import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4G - PARAMETERIZED INEQUALITIES', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const mul = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '*', args: [a, b] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  it('a*x > 1 -> unsupported: requires_parameter_sign_analysis', () => {
    const expr = mul(sym('a'), sym('x'));
    const node = ineq('>', expr, num('1'));
    const result = engine.solve(node, 'x');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.status).toBe('requires_parameter_sign_analysis');
    }
  });

  it('x^2 + a > 0 -> unsupported: requires_parameter_sign_analysis', () => {
    const expr = { type: 'Operator', operator: '+', args: [{ type: 'Operator', operator: '^', args: [sym('x'), num('2')] }, sym('a')] };
    const node = ineq('>', expr as any, num('0'));
    const result = engine.solve(node, 'x');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.status).toBe('requires_parameter_sign_analysis');
    }
  });
});
