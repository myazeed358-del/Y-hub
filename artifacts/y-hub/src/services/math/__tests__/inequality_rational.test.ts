import { InequalityEngine } from '../symbolic/inequality';
import { InequalityNode, CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 4C - RATIONAL INEQUALITY ENGINE', () => {
  const engine = new InequalityEngine();

  const num = (v: string): CanonicalAST => ({ type: 'Number', value: v });
  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const add = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '+', args: [a, b] });
  const sub = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '-', args: [a, b] });
  const mul = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '*', args: [a, b] });
  const div = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '/', args: [a, b] });
  const pow = (a: CanonicalAST, b: CanonicalAST): CanonicalAST => ({ type: 'Operator', operator: '^', args: [a, b] });
  const ineq = (op: any, lhs: CanonicalAST, rhs: CanonicalAST): InequalityNode => ({
    type: 'Inequality', operator: op, lhs, rhs
  });

  const xMinus2 = sub(sym('x'), num('2'));
  const xPlus1 = add(sym('x'), num('1'));
  const xMinus1 = sub(sym('x'), num('1'));
  
  // (x-2)/(x+1)
  const frac1 = div(xMinus2, xPlus1);
  
  // (x^2-1)/(x-1)
  const xSqMinus1 = sub(pow(sym('x'), num('2')), num('1'));
  const fracHole = div(xSqMinus1, xMinus1);
  
  it('1. (x-2)/(x+1) > 0 -> (-inf,-1) U (2,+inf)', () => {
    const node = ineq('>', frac1, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect((solution.intervals[0].right as any).rational.num).toBe(-1n);
    expect((solution.intervals[1].left as any).rational.num).toBe(2n);
  });

  it('2. (x-2)/(x+1) < 0 -> (-1,2)', () => {
    const node = ineq('<', frac1, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect((solution.intervals[0].left as any).rational.num).toBe(-1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
  });

  it('4. (x-2)/(x+1) <= 0 -> (-1,2]', () => {
    const node = ineq('<=', frac1, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(1);
    expect(solution.intervals[0].leftClosed).toBe(false); // denom root
    expect(solution.intervals[0].rightClosed).toBe(true);  // num root
  });

  it('6. (x^2-1)/(x-1) > 0 -> (-1,1) U (1,+inf)', () => {
    const node = ineq('>', fracHole, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].left as any).rational.num).toBe(-1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(1n);
    expect((solution.intervals[1].left as any).rational.num).toBe(1n);
  });

  it('7. (x^2-1)/(x-1) >= 0 -> [-1,1) U (1,+inf)', () => {
    const node = ineq('>=', fracHole, num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].left as any).rational.num).toBe(-1n);
    expect(solution.intervals[0].leftClosed).toBe(true);
    expect((solution.intervals[0].right as any).rational.num).toBe(1n);
    expect(solution.intervals[0].rightClosed).toBe(false); // domain forbidden
    expect((solution.intervals[1].left as any).rational.num).toBe(1n);
    expect(solution.intervals[1].leftClosed).toBe(false);
  });

  it('8. 0/(x-1) > 0 -> EmptySet', () => {
    const node = ineq('>', div(num('0'), xMinus1), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(0);
  });

  it('9. 0/(x-1) >= 0 -> (-inf,1) U (1,+inf)', () => {
    const node = ineq('>=', div(num('0'), xMinus1), num('0'));
    const { solution } = engine.solve(node, 'x');
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].rightClosed).toBe(false);
    expect((solution.intervals[0].right as any).rational.num).toBe(1n);
  });
  
  it('12. (x-1)/(x-2)^2 > 0 -> (-inf,1) U (2,+inf) ... wait! Actually it should be (1, 2) U (2, +inf)', () => {
    // wait... num=x-1 (root 1), den=(x-2)^2 (root 2)
    // For x > 2, pos/pos = pos
    // For 1 < x < 2, pos/pos = pos
    // For x < 1, neg/pos = neg
    // So answer is (1,2) U (2,+inf).
    const expr = div(xMinus1, pow(sub(sym('x'), num('2')), num('2')));
    const node = ineq('>', expr, num('0'));
    const { solution } = engine.solve(node, 'x');
    
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].left as any).rational.num).toBe(1n);
    expect((solution.intervals[0].right as any).rational.num).toBe(2n);
    expect((solution.intervals[1].left as any).rational.num).toBe(2n);
  });

  it('13. (x-1)^2/(x+2) > 0 -> (-2,1) U (1,+inf)', () => {
    // num=(x-1)^2 (root 1, mult 2), den=(x+2) (root -2, mult 1)
    // x > 1: pos/pos = pos
    // -2 < x < 1: pos/pos = pos
    // x < -2: pos/neg = neg
    // Because > 0 (strict), x=1 is excluded!
    const expr = div(pow(xMinus1, num('2')), add(sym('x'), num('2')));
    const node = ineq('>', expr, num('0'));
    const { solution } = engine.solve(node, 'x');
    
    expect(solution.intervals.length).toBe(2);
    expect((solution.intervals[0].left as any).rational.num).toBe(-2n);
    expect((solution.intervals[0].right as any).rational.num).toBe(1n);
    expect((solution.intervals[1].left as any).rational.num).toBe(1n);
  });

  it('26. 1/(x-1) > 1/(x+1) -> (-inf,-1) U (1,+inf)', () => {
    // 1/(x-1) > 1/(x+1)
    const lhs = div(num('1'), xMinus1);
    const rhs = div(num('1'), xPlus1);
    const node = ineq('>', lhs, rhs);
    const { solution, steps } = engine.solve(node, 'x');
    
    expect(solution.intervals.length).toBe(2);
    expect(solution.intervals[0].left.type).toBe('infinity');
    expect((solution.intervals[0].right as any).rational.num).toBe(-1n);
    expect(solution.intervals[0].rightClosed).toBe(false);
    expect((solution.intervals[1].left as any).rational.num).toBe(1n);
    expect(solution.intervals[1].leftClosed).toBe(false);
    expect(solution.intervals[1].right.type).toBe('infinity');
    
    // Verify trace
    const trace = steps.find(s => s.transformation?.normalizationType === 'rational_difference');
    expect(trace).toBeDefined();
    expect((trace as any).transformation.crossMultiplication).toBe('not_used');
  });
});
