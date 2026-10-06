import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4D - ABSOLUTE VALUE INEQUALITY ENGINE', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const add = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '+', args: [a, b] });
  const sub = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '-', args: [a, b] });
  const mul = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '*', args: [a, b] });
  const div = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '/', args: [a, b] });
  const pow = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '^', args: [a, b] });
  const abs = (a: CanonicalAST): CanonicalAST => ({ type: 'Function', name: 'abs', args: [a] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  const xMinus2 = sub(sym('x'), num('2'));
  
  it('1. |x-2| < 3 -> (-1,5)', () => {
    const node = ineq('<', abs(xMinus2), num('3'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(5n);
    expect(solution.intervals[0].leftClosed).toBe(false);
    expect(solution.intervals[0].rightClosed).toBe(false);
  });

  it('2. |x-2| <= 3 -> [-1,5]', () => {
    const node = ineq('<=', abs(xMinus2), num('3'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(5n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect(solution.intervals[0].rightClosed).toBe(true);
  });

  it('3. |x-2| > 3 -> (-inf,-1) U (5,+inf)', () => {
    const node = ineq('>', abs(xMinus2), num('3'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect((solution.intervals[0].right as any).rational.num).toBe(-1n);
    expect((solution.intervals[1].left as any).rational.num).toBe(5n);
    expect(solution.intervals[1].right.type).toBe('infinity');
  });

  it('4. |x-2| >= 3 -> (-inf,-1] U [5,+inf)', () => {
    const node = ineq('>=', abs(xMinus2), num('3'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].rightClosed).toBe(true);
    expect(solution.intervals[1].leftClosed).toBe(true);
  });

  it('5. |x-2| != 3 -> (-inf,-1) U (-1,5) U (5,+inf)', () => {
    const node = ineq('!=', abs(xMinus2), num('3'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(3);
    expect((solution.intervals[0].right as any).rational.num).toBe(-1n);
    expect((solution.intervals[1].left as any).rational.num).toBe(-1n);
    expect((solution.intervals[1].right as any).rational.num).toBe(5n);
    expect((solution.intervals[2].left as any).rational.num).toBe(5n);
  });

  it('6. |2x+1| < 5 -> (-3,2)', () => {
    const expr = add(mul(num('2'), sym('x')), num('1'));
    const node = ineq('<', abs(expr), num('5'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-3n);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
  });

  it('7. |3x-6| >= 6 -> (-inf,0] U [4,+inf)', () => {
    const expr = sub(mul(num('3'), sym('x')), num('6'));
    const node = ineq('>=', abs(expr), num('6'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].right as any).rational.num).toBe(0n);
    expect((solution.intervals[1].left as any).rational.num).toBe(4n);
  });

  it('8. |x²-4| < 5 -> (-3,3)', () => {
    const expr = sub(pow(sym('x'), num('2')), num('4'));
    const node = ineq('<', abs(expr), num('5'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-3n);
    expect((solution.intervals[0].right as any).rational.num).toBe(3n);
  });

  it('9. |(x-1)/(x+2)| > 1 -> (-inf,-2) U (-2,-0.5)', () => {
    // |(x-1)/(x+2)| > 1 => (x-1)/(x+2) > 1 OR (x-1)/(x+2) < -1
    // (x-1-x-2)/(x+2) > 0 => -3/(x+2) > 0 => x+2 < 0 => x < -2
    // (x-1+x+2)/(x+2) < 0 => (2x+1)/(x+2) < 0 => -2 < x < -0.5
    // Union: (-inf, -2) U (-2, -0.5)
    // Wait, the prompt implies the solution, let's verify!
    const expr = div(sub(sym('x'), num('1')), add(sym('x'), num('2')));
    const node = ineq('>', abs(expr), num('1'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect((solution.intervals[0].right as any).rational.num).toBe(-2n);
    expect((solution.intervals[1].left as any).rational.num).toBe(-2n);
    expect((solution.intervals[1].right as any).rational.num).toBe(-1n); // num
    expect((solution.intervals[1].right as any).rational.den).toBe(2n);  // den => -0.5
  });

  it('16. Zero-bound rational case |(x-1)/(x-2)| <= 0', () => {
    const expr = div(sub(sym('x'), num('1')), sub(sym('x'), num('2')));
    const node = ineq('<=', abs(expr), num('0'));
    const { solution } = engine.solve(node, 'x');
    // Result should be just x=1
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(1n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect(solution.intervals[0].rightClosed).toBe(true);
  });

  it('11. zero bound |x-2| < 0 -> EmptySet', () => {
    const node = ineq('<', abs(xMinus2), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(0);
  });

  it('10. negative bound |x-2| < -1 -> EmptySet', () => {
    const node = ineq('<', abs(xMinus2), num('-1'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(0);
  });

  it('10b. negative bound |x-2| > -1 -> UniversalSet', () => {
    const node = ineq('>', abs(xMinus2), num('-1'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect(solution.intervals[0].right.type).toBe('infinity');
  });

  it('12. unknown symbolic bound', () => {
    const node = ineq('<', abs(xMinus2), sym('a'));
    const result = engine.solve(node, 'x');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.status).toBe('requires_parameter_sign_analysis');
    }
  });

  it('14. multiple absolute values', () => {
    const expr = add(abs(sym('x')), abs(xMinus2));
    const node = ineq('<', expr, num('5'));
    const result = engine.solve(node, 'x');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.status).toBe('multiple_absolute_values_requires_partitioning');
    }
  });

  it('15. nested absolute value', () => {
    const expr = abs(sub(abs(sym('x')), num('1')));
    const node = ineq('<', expr, num('5'));
    const result = engine.solve(node, 'x');
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.status).toBe('nested_absolute_value_requires_branch_solver');
    }
  });
});
