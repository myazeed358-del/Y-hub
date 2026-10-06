import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4B - POLYNOMIAL INEQUALITY ENGINE', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const add = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '+', args: [a, b] });
  const sub = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '-', args: [a, b] });
  const mul = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '*', args: [a, b] });
  const pow = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '^', args: [a, b] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  // x^2 - 4
  const quadMinus4 = sub(pow(sym('x'), num('2')), num('4'));
  
  // (x-2)^2
  const quadPerfect = pow(sub(sym('x'), num('2')), num('2'));

  // (x-2)^3
  const cubePerfect = pow(sub(sym('x'), num('2')), num('3'));

  it('1. x^2 - 4 > 0 -> (-inf,-2) U (2,+inf)', () => {
    const node = ineq('>', quadMinus4, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].right as any).rational.num).toBe(-2n);
    expect((solution.intervals[1].left as any).rational.num).toBe(2n);
  });

  it('2. x^2 - 4 <= 0 -> [-2,2]', () => {
    const node = ineq('<=', quadMinus4, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-2n);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect(solution.intervals[0].rightClosed).toBe(true);
  });

  it('3. (x-2)^2 >= 0 -> UniversalSet', () => {
    const node = ineq('>=', quadPerfect, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect(solution.intervals[0].right.type).toBe('infinity');
  });

  it('4. (x-2)^2 < 0 -> EmptySet', () => {
    const node = ineq('<', quadPerfect, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(0);
  });

  it('5. (x-2)^3 > 0 -> (2,+inf)', () => {
    const node = ineq('>', cubePerfect, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(2n);
    expect(solution.intervals[0].leftClosed).toBe(false);
  });

  it('15. x^2 > 0 -> (-inf,0) U (0,+inf)', () => {
    const node = ineq('>', pow(sym('x'), num('2')), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].right as any).rational.num).toBe(0n);
    expect((solution.intervals[1].left as any).rational.num).toBe(0n);
    expect(solution.intervals[0].rightClosed).toBe(false);
  });

  it('13. x^3 - 6x^2 + 11x - 6 > 0 -> (1,2) U (3,+inf)', () => {
    // x^3 - 6x^2 + 11x - 6
    const p = sub(add(sub(pow(sym('x'), num('3')), mul(num('6'), pow(sym('x'), num('2')))), mul(num('11'), sym('x'))), num('6'));
    const node = ineq('>', p, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].left as any).rational.num).toBe(1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
    expect((solution.intervals[1].left as any).rational.num).toBe(3n);
  });

  describe('Root Isolation Incomplete Hardening', () => {
    it('14. x^2 - 3 > 0 -> exact algebraic endpoints', () => {
      const node = ineq('>', sub(pow(sym('x'), num('2')), num('3')), num('0'));
      const result = engine.solve(node, 'x');

      expect(result.kind).toBe('solution_set');

      if (result.kind === 'solution_set') {
        expect(result.solution.intervals.length).toBe(2);
        expect((result.solution.intervals[0].right as any).algebraic).toBeDefined();
        expect((result.solution.intervals[1].left as any).algebraic).toBeDefined();
      }
    });

    it('15. x^5 - x + 1 > 0 -> unsupported root isolation', () => {
      const p = add(sub(pow(sym('x'), num('5')), sym('x')), num('1'));
      const node = ineq('>', p, num('0'));
      const result = engine.solve(node, 'x');

      expect(result.kind).toBe('unsupported');

      if (result.kind === 'unsupported') {
        expect(result.status).toBe('root_isolation_incomplete');
      }
    });
  });
});
