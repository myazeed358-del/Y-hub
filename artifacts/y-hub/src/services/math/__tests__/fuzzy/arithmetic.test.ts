import { intervalMul, intervalDiv, fuzzyArithmetic } from '../../fuzzy/arithmetic';
import { TriangularFuzzyNumber } from '../../fuzzy/numbers';

describe('Fuzzy Arithmetic', () => {
  it('Interval Multiplication: handles zero crossings', () => {
    const i1 = { lower: -2, upper: 2 };
    const i2 = { lower: -1, upper: 3 };
    const res = intervalMul(i1, i2);
    // min(-2*-1, -2*3, 2*-1, 2*3) = min(2, -6, -2, 6) = -6
    // max(...) = 6
    expect(res.lower).toBe(-6);
    expect(res.upper).toBe(6);
  });

  it('Interval Division: rejects zero domain', () => {
    const i1 = { lower: 1, upper: 2 };
    const i2 = { lower: -1, upper: 1 };
    expect(intervalDiv(i1, i2)).toBe('invalid_domain');
  });

  it('fuzzyArithmetic: evaluates metadata correctly', () => {
    const f1 = new TriangularFuzzyNumber(1, 2, 3);
    const f2 = new TriangularFuzzyNumber(2, 3, 4);
    const res = fuzzyArithmetic(f1, f2, 'add', 3);
    expect(res.status).toBe('success');
    expect(res.cuts.length).toBe(3);
    expect(res.mathematicalExactness).toBe('exact');
    expect(res.representationAccuracy).toBe('sampled');
  });
});
