import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';
import { SetEngine } from '../symbolic/sets';
import { Endpoint, Interval } from '../types/set';

describe('CORE CALCULUS 4A - INEQUALITY ENGINE', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const add = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '+', args: [a, b] });
  const sub = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '-', args: [a, b] });
  const mul = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '*', args: [a, b] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  const infPos: Endpoint = { type: 'infinity', sign: 1 };
  const infNeg: Endpoint = { type: 'infinity', sign: -1 };
  const val = (v: number): Endpoint => ({ type: 'value', ast: num(v.toString()), rational: { num: BigInt(v), den: 1n } });

  it('1. 2x + 3 > 7 -> (2, +inf)', () => {
    // 2x + 3 > 7
    const node = ineq('>', add(mul(num('2'), sym('x')), num('3')), num('7'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect(solution.intervals[0].left.type).toBe('value');
    expect((solution.intervals[0].left as any).rational.num).toBe(2n);
    expect(solution.intervals[0].leftClosed).toBe(false);
    expect(solution.intervals[0].right.type).toBe('infinity');
  });

  it('2. 2x + 3 >= 7 -> [2, +inf)', () => {
    const node = ineq('>=', add(mul(num('2'), sym('x')), num('3')), num('7'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals[0].leftClosed).toBe(true);
  });

  it('3. 2x + 3 < 7 -> (-inf, 2)', () => {
    const node = ineq('<', add(mul(num('2'), sym('x')), num('3')), num('7'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals[0].right.type).toBe('value');
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
    expect(solution.intervals[0].rightClosed).toBe(false);
  });

  it('4. 2x + 3 <= 7 -> (-inf, 2]', () => {
    const node = ineq('<=', add(mul(num('2'), sym('x')), num('3')), num('7'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals[0].rightClosed).toBe(true);
  });

  it('5. -3x + 6 > 0 -> x < 2', () => {
    const node = ineq('>', add(mul(num('-3'), sym('x')), num('6')), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals[0].right.type).toBe('value');
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
  });

  it('7. 5x - 2 > 3x + 4 -> x > 3', () => {
    const node = ineq('>', sub(mul(num('5'), sym('x')), num('2')), add(mul(num('3'), sym('x')), num('4')));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals[0].left.type).toBe('value');
    expect((solution.intervals[0].left as any).rational.num).toBe(3n);
  });

  it('9. 0x + 3 > 0 -> UniversalSet', () => {
    const node = ineq('>', add(mul(num('0'), sym('x')), num('3')), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect(solution.intervals[0].right.type).toBe('infinity');
  });

  it('10. 0x + 3 < 0 -> EmptySet', () => {
    const node = ineq('<', add(mul(num('0'), sym('x')), num('3')), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(0);
  });

  describe('Interval Set Math', () => {
    it('15. Interval union normalization (1,3] U [3,5) -> (1,5)', () => {
      const ints: Interval[] = [
        { left: val(1), right: val(3), leftClosed: false, rightClosed: true },
        { left: val(3), right: val(5), leftClosed: true, rightClosed: false }
      ];
      const res = SetEngine.normalizeUnion(ints);
      expect(res.length).toBe(1);
      expect(res[0].leftClosed).toBe(false);
      expect(res[0].rightClosed).toBe(false);
      expect((res[0].right as any).rational.num).toBe(5n);
    });

    it('16. Interval intersection [1,4] int [3,5] -> [3,4]', () => {
      const a: Interval[] = [{ left: val(1), right: val(4), leftClosed: true, rightClosed: true }];
      const b: Interval[] = [{ left: val(3), right: val(5), leftClosed: true, rightClosed: true }];
      const res = SetEngine.intersection(a, b);
      expect(res.length).toBe(1);
      expect((res[0].left as any).rational.num).toBe(3n);
      expect((res[0].right as any).rational.num).toBe(4n);
      expect(res[0].leftClosed).toBe(true);
      expect(res[0].rightClosed).toBe(true);
    });
  });

  describe('!= semantics and Domain Intersection', () => {
    it('11. 2x + 3 != 7 -> (-inf, 2) U (2, +inf)', () => {
      const node = ineq('!=', add(mul(num('2'), sym('x')), num('3')), num('7'));
      const { solution } = engine.solve(node, 'x');
      expect(solution.intervals.length).toBe(2);
      expect(solution.intervals[0].left.type).toBe('infinity');
      expect((solution.intervals[0].right as any).rational.num).toBe(2n);
      expect(solution.intervals[0].rightClosed).toBe(false);
      
      expect((solution.intervals[1].left as any).rational.num).toBe(2n);
      expect(solution.intervals[1].leftClosed).toBe(false);
      expect(solution.intervals[1].right.type).toBe('infinity');
    });

    it('12. 0x + 3 != 3 -> EmptySet', () => {
      const node = ineq('!=', add(mul(num('0'), sym('x')), num('3')), num('3'));
      const { solution } = engine.solve(node, 'x');
      expect(solution.intervals.length).toBe(0);
    });

    it('13. 0x + 3 != 4 -> UniversalSet', () => {
      const node = ineq('!=', add(mul(num('0'), sym('x')), num('3')), num('4'));
      const { solution } = engine.solve(node, 'x');
      expect(solution.intervals.length).toBe(1);
      expect(solution.intervals[0].left.type).toBe('infinity');
      expect(solution.intervals[0].right.type).toBe('infinity');
    });

    it('14. Domain intersection with linear inequality', () => {
      // (1 / (x - 2)) > 0
      // Normal inequality says ... wait, we need to solve the full rational for this.
      // Let's just simulate an AST that triggers DomainAnalyzer and has a linear root.
      // For instance: 3x > 6  but with domain x != 5 (e.g. 3x + 0/(x-5) > 6)
      const node = ineq('>', 
        add(mul(num('3'), sym('x')), { type: 'Operator', operator: '/', args: [num('0'), sub(sym('x'), num('5'))] }), 
        num('6')
      );
      const { solution } = engine.solve(node, 'x');
      // 3x > 6 => x > 2. Domain: x - 5 != 0 => x != 5.
      // Expected intersection: (2, 5) U (5, +inf)
      expect(solution.intervals.length).toBe(2);
      
      expect((solution.intervals[0].left as any).rational.num).toBe(2n);
      expect((solution.intervals[0].right as any).rational.num).toBe(5n);
      expect(solution.intervals[0].leftClosed).toBe(false);
      expect(solution.intervals[0].rightClosed).toBe(false);

      expect((solution.intervals[1].left as any).rational.num).toBe(5n);
      expect(solution.intervals[1].leftClosed).toBe(false);
      expect(solution.intervals[1].right.type).toBe('infinity');
    });
  });
});

