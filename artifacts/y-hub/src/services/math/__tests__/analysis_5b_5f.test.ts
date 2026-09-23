import { FunctionAnalyzer } from '../analysis/FunctionAnalyzer';
import { FunctionAnalysisRequest } from '../types/analysis';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 5B-5F - FUNCTION ANALYSIS ENGINE', () => {
  const analyzer = new FunctionAnalyzer();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const fn = (name: string, args: CanonicalAST[]): CanonicalAST => ({ type: 'Function', name, args });

  it('1. f(x) = x^2', () => {
    const ast = op('^', [sym('x'), num('2')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(res.criticalPoints?.length).toBe(1);
    expect((res.criticalPoints![0].point.ast as any).value).toBe('0');
    
    expect(res.increasingIntervals?.length).toBe(1);
    expect((res.increasingIntervals![0].left.ast as any).value).toBe('0');
    expect(res.increasingIntervals![0].right.type).toBe('infinity');
    
    expect(res.decreasingIntervals?.length).toBe(1);
    expect(res.decreasingIntervals![0].left.type).toBe('infinity');
    expect((res.decreasingIntervals![0].right.ast as any).value).toBe('0');
    
    expect(res.extrema?.length).toBe(1);
    expect(res.extrema![0].type).toBe('local_minimum');
    
    expect(res.concaveUpIntervals?.length).toBe(1);
    expect(res.inflectionPoints?.length).toBe(0);
  });

  it('5. f(x) = 1/x', () => {
    const ast = op('/', [num('1'), sym('x')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);
    
    expect(res.domain.intervals.length).toBe(2);
    expect(res.verticalAsymptotes?.length).toBe(1);
    expect(res.horizontalAsymptotes?.length).toBe(2); // one for +inf, one for -inf
    
    expect(res.graphData?.behaviorSegments.length).toBe(2);
  });

  it('10. f(x) = (x^2+1)/x', () => {
    const ast = op('/', [op('+', [op('^', [sym('x'), num('2')]), num('1')]), sym('x')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);
    
    expect(res.verticalAsymptotes?.length).toBe(1);
    expect(res.slantAsymptotes?.length).toBeGreaterThan(0);
  });

});
