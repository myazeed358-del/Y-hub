import { IntegrationEngine } from '../symbolic/integration';
import { DerivativeEngine } from '../symbolic/derivative';
import { DomainAnalyzer } from '../domain';
import { InequalityEngine } from '../symbolic/inequality';
import { IntegrationRequest } from '../types/integration';
import { CanonicalAST } from '../types/ast';
import { SetEngine } from '../symbolic/sets';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';

describe('CORE CALCULUS 6F - CRITICAL MICRO-FIX', () => {
  const engine = new IntegrationEngine();
  const derivEngine = new DerivativeEngine();
  const domainAnalyzer = new DomainAnalyzer();
  const ineqEngine = new InequalityEngine();
  const simplifier = new SymbolicSimplifier();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
  const abs = (arg: CanonicalAST): CanonicalAST => func('abs', arg);
  const sqrt = (arg: CanonicalAST): CanonicalAST => func('sqrt', arg);

  it('A) d/dx asec(x)', () => {
    // Expected: 1 / (|x| sqrt(x²-1))
    const ast = func('asec', sym('x'));
    const dF = derivEngine.differentiate(ast, 'x');
    const expectedDenom = op('*', [abs(sym('x')), sqrt(op('-', [op('^', [sym('x'), num('2')]), num('1')]))]);
    const expected = op('/', [num('1'), expectedDenom]);
    expect(ASTUtils.structuralEquals(dF, expected)).toBe(true);
  });

  it('B) d/dx asec(x/a), under a>0', () => {
    // u = x/a => u' = 1/a
    // Expected: (1/a) / (|x/a| sqrt((x/a)^2 - 1))
    const u = op('/', [sym('x'), sym('a')]);
    const ast = func('asec', u);
    const dF = derivEngine.differentiate(ast, 'x');
    // Just ensuring no error and proper structure
    expect(dF.type).toBe('Operator');
    expect((dF as any).operator).toBe('/');
  });

  it('C) d/dx acsc(x)', () => {
    // Expected: -1 / (|x| sqrt(x²-1))
    const ast = func('acsc', sym('x'));
    const dF = derivEngine.differentiate(ast, 'x');
    const expectedDenom = op('*', [abs(sym('x')), sqrt(op('-', [op('^', [sym('x'), num('2')]), num('1')]))]);
    const expected = op(
      '/',
      [
        num('-1'),
        expectedDenom
      ]
    );

    expect(
      ASTUtils.structuralEquals(
        dF,
        expected
      )
    ).toBe(true);
  });

  it('D) d/dx tan(asec(x/a))', () => {
    // Just verify differentiating doesn't throw and structure is solid
    const u = op('/', [sym('x'), sym('a')]);
    const ast = func('tan', func('asec', u));
    const dF = derivEngine.differentiate(ast, 'x');
    expect(dF.type).toBe('Operator'); // Should be a valid AST
  });

  it('E) Domain of asec(x/a), a>0', () => {
    // We mock 'a' as a known number '2' for the domain test, since a>0 is given
    const u = op('/', [sym('x'), num('2')]);
    const ast = func('asec', u);
    
    // Simulate integration engine's domain process
    const restrictions = domainAnalyzer.analyze(ast);
    let domainSet = SetEngine.createRealLine();
    for (const r of restrictions) {
       if (r.type === 'inverse_sec_csc') {
          const lteq: CanonicalAST = { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: num('-1') };
          const gteq: CanonicalAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: num('1') };
          const s1 = ineqEngine.solve(lteq, 'x');
          const s2 = ineqEngine.solve(gteq, 'x');
          if (s1.kind === 'solution_set' && s2.kind === 'solution_set') {
             const union = SetEngine.union(s1.solution.intervals, s2.solution.intervals);
             domainSet = { intervals: SetEngine.intersection(domainSet.intervals, union) };
          }
       }
    }
    expect(domainSet.intervals.length).toBe(2);
    // left interval is (-infinity, -2]
    const leftInt = domainSet.intervals[0];
    expect(leftInt.left.type).toBe('infinity');
    expect((leftInt.left as any).sign).toBe(-1);
    expect(leftInt.right.type).toBe('value');
    expect((leftInt.right as any).rational?.num).toBe(-2n);
    expect(leftInt.rightClosed).toBe(true);
    
    // right interval is [2, infinity)
    const rightInt = domainSet.intervals[1];
    expect(rightInt.left.type).toBe('value');
    expect((rightInt.left as any).rational?.num).toBe(2n);
    expect(rightInt.leftClosed).toBe(true);
    expect(rightInt.right.type).toBe('infinity');
    expect((rightInt.right as any).sign).toBe(1);
  });
});
