import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4E - RADICAL INEQUALITIES', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const sqrt = (a: CanonicalAST): CanonicalAST => ({ type: 'Function', name: 'sqrt', args: [a] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  it('sqrt(x) < 2 -> [0, 4)', () => {
    const node = ineq('<', sqrt(sym('x')), num('2'));
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(0n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect((solution.intervals[0].right as any).rational.num).toBe(4n);
    expect(solution.intervals[0].rightClosed).toBe(false);
  });

  it('sqrt(x) >= 2 -> [4, +inf)', () => {
    const node = ineq('>=', sqrt(sym('x')), num('2'));
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(4n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect(solution.intervals[0].right.type).toBe('infinity');
  });

  it('sqrt(x) < 0 -> EmptySet', () => {
    const node = ineq('<', sqrt(sym('x')), num('0'));
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(0);
  });

  it('x^2 > 3 -> (-inf, -sqrt(3)) U (sqrt(3), +inf)', () => {
    const expr: CanonicalAST = { type: 'Operator', operator: '-', args: [
      { type: 'Operator', operator: '^', args: [sym('x'), num('2')] },
      num('3')
    ]};
    const node = ineq('>', expr, num('0'));
    const result = engine.solve(node, 'x');
    if (result.kind !== 'solution_set') throw new Error('Expected solution_set');
    const { solution } = result;
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect((solution.intervals[0].right as any).algebraic).toBeDefined();
    expect((solution.intervals[1].left as any).algebraic).toBeDefined();
    expect(solution.intervals[1].right.type).toBe('infinity');
  });
});
