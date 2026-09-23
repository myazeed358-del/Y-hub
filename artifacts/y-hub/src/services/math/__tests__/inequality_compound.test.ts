import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4F - COMPOUND INEQUALITIES', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  it('x > 1 AND x < 5 -> (1, 5)', () => {
    const node: CanonicalAST = {
      type: 'Function',
      name: 'AND',
      args: [
        ineq('>', sym('x'), num('1')),
        ineq('<', sym('x'), num('5'))
      ]
    };
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(5n);
  });

  it('x > 5 AND x < 2 -> EmptySet', () => {
    const node: CanonicalAST = {
      type: 'Operator',
      operator: '&&' as any,
      args: [
        ineq('>', sym('x'), num('5')),
        ineq('<', sym('x'), num('2'))
      ]
    };
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(0);
  });

  it('x < 2 OR x > 5 -> (-inf, 2) U (5, +inf)', () => {
    const node: CanonicalAST = {
      type: 'Function',
      name: 'OR',
      args: [
        ineq('<', sym('x'), num('2')),
        ineq('>', sym('x'), num('5'))
      ]
    };
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
    expect((solution.intervals[1].left as any).rational.num).toBe(5n);
  });
});
