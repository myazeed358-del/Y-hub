import { FunctionAnalyzer } from '../analysis/FunctionAnalyzer';
import { FunctionAnalysisRequest } from '../types/analysis';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 5A - FUNCTION ANALYSIS ENGINE', () => {
  const analyzer = new FunctionAnalyzer();

  const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
  const num = (value: string): CanonicalAST => ({ type: 'Number', value });
  const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
  const fn = (name: string, args: CanonicalAST[]): CanonicalAST => ({ type: 'Function', name, args });

  it('1. f(x) = x^2 - 4', () => {
    // x^2 - 4
    const ast = op('-', [op('^', [sym('x'), num('2')]), num('4')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(res.domain.intervals.length).toBe(1);
    expect(res.domain.intervals[0].left.type).toBe('infinity');
    expect(res.domain.intervals[0].right.type).toBe('infinity');

    // intercept
    expect(res.xIntercepts).not.toBe('root_isolation_incomplete');
    if (Array.isArray(res.xIntercepts)) {
       expect(res.xIntercepts.length).toBe(2);
       const vals = res.xIntercepts.map(e => (e.ast as any).value).sort();
       expect(vals).toEqual(['-2', '2']);
    }

    expect(res.yIntercept).toBeDefined();
    expect((res.yIntercept?.ast as any).value).toBe('-4');
    expect(res.discontinuities.length).toBe(0);
  });

  it('2. f(x) = (x^2 - 1)/(x - 1)', () => {
    // (x^2 - 1) / (x - 1)
    const numPart = op('-', [op('^', [sym('x'), num('2')]), num('1')]);
    const denPart = op('-', [sym('x'), num('1')]);
    const ast = op('/', [numPart, denPart]);

    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(res.domain.intervals.length).toBe(2); // (-inf, 1) U (1, inf)
    
    // intercept
    expect(Array.isArray(res.xIntercepts)).toBe(true);
    if (Array.isArray(res.xIntercepts)) {
       expect(res.xIntercepts.length).toBe(1);
       expect((res.xIntercepts[0].ast as any).value).toBe('-1'); // x=1 is not in domain
    }

    expect((res.yIntercept?.ast as any).value).toBe('1');
    expect(res.discontinuities.length).toBe(1);
    expect((res.discontinuities[0].point.ast as any).value).toBe('1');
    expect(res.discontinuities[0].status).toBe('removable_discontinuity');
    expect((res.discontinuities[0].limitValue as any).value).toBe('2');
  });

  it('3. f(x) = 1/(x-2)', () => {
    const ast = op('/', [num('1'), op('-', [sym('x'), num('2')])]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(Array.isArray(res.xIntercepts)).toBe(true);
    if (Array.isArray(res.xIntercepts)) {
       expect(res.xIntercepts.length).toBe(0);
    }

    expect(res.discontinuities.length).toBe(1);
    expect(res.discontinuities[0].status).toBe('infinite_discontinuity');
  });

  it('4. f(x) = sqrt(x-1)', () => {
    const ast = fn('sqrt', [op('-', [sym('x'), num('1')])]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(res.yIntercept).toBeUndefined(); // x=0 not in domain
    expect(res.discontinuities.length).toBe(1);
    expect(res.discontinuities[0].status).toBe('domain_boundary');
    expect(res.discontinuities[0].leftDomainAccessible).toBe(false);
    expect(res.discontinuities[0].rightDomainAccessible).toBe(true);
  });

  it('5. f(x) = ln(x+3)', () => {
    const ast = fn('ln', [op('+', [sym('x'), num('3')])]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);
    
    expect(res.yIntercept).toBeDefined(); // ln(3)
    expect(res.domain.intervals[0].leftClosed).toBe(false); // open interval
  });

  it('6. f(x) = e^x', () => {
    const ast = fn('exp', [sym('x')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(Array.isArray(res.xIntercepts) && res.xIntercepts.length === 0).toBe(true);
    expect((res.yIntercept?.ast as any).value).toBe('1');
  });

  it('7. f(x) = |x|', () => {
    const ast = fn('abs', [sym('x')]);
    const req: FunctionAnalysisRequest = { expression: ast, variable: 'x', mode: 'real' };
    const res = analyzer.analyze(req);

    expect(Array.isArray(res.xIntercepts) && res.xIntercepts.length === 1).toBe(true);
    if (Array.isArray(res.xIntercepts)) {
      expect((res.xIntercepts[0].ast as any).value).toBe('0');
    }
  });

});
