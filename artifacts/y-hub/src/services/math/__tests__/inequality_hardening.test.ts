import { SetEngine } from '../symbolic/sets';
import { Endpoint, Interval } from '../types/set';

describe('CORE CALCULUS 4H - SET ENGINE HARDENING', () => {

  const ep = (v: number): Endpoint => ({ type: 'value', ast: { type: 'Number', value: v.toString() }, rational: { num: BigInt(v), den: 1n } });
  const inf = (sign: 1 | -1): Endpoint => ({ type: 'infinity', sign });

  it('normalizeUnion: (0, 2) U (1, 3) -> (0, 3)', () => {
    const i1: Interval = { left: ep(0), right: ep(2), leftClosed: false, rightClosed: false };
    const i2: Interval = { left: ep(1), right: ep(3), leftClosed: false, rightClosed: false };
    
    const union = SetEngine.normalizeUnion([i1, i2]);
    expect(union.length).toBe(1);
    expect((union[0].left as any).rational.num).toBe(0n);
    expect((union[0].right as any).rational.num).toBe(3n);
  });

  it('normalizeUnion: (0, 1) U (1, 2) -> (0, 1) U (1, 2)', () => {
    const i1: Interval = { left: ep(0), right: ep(1), leftClosed: false, rightClosed: false };
    const i2: Interval = { left: ep(1), right: ep(2), leftClosed: false, rightClosed: false };
    
    const union = SetEngine.normalizeUnion([i1, i2]);
    expect(union.length).toBe(2);
  });

  it('normalizeUnion: (0, 1] U (1, 2) -> (0, 2)', () => {
    const i1: Interval = { left: ep(0), right: ep(1), leftClosed: false, rightClosed: true };
    const i2: Interval = { left: ep(1), right: ep(2), leftClosed: false, rightClosed: false };
    
    const union = SetEngine.normalizeUnion([i1, i2]);
    expect(union.length).toBe(1);
    expect((union[0].right as any).rational.num).toBe(2n);
  });

  it('exactCompare: bounded algebraic refinement', () => {
    // Let's create two algebraic endpoints representing sqrt(2) and sqrt(3)
    // sqrt(2) root of x^2 - 2 = 0 in [1, 2]
    const algSqrt2: Endpoint = {
      type: 'value', ast: { type: 'Number', value: '1.414' },
      algebraic: {
        ast: { type: 'Number', value: '1.414' },
        degree: 2,
        isolatingInterval: { left: { num: 1n, den: 1n }, right: { num: 2n, den: 1n } },
        polyCoeffsRat: [{ num: -2n, den: 1n }, { num: 0n, den: 1n }, { num: 1n, den: 1n }] // x^2 - 2
      }
    };
    // sqrt(3) root of x^2 - 3 = 0 in [1, 2]
    const algSqrt3: Endpoint = {
      type: 'value', ast: { type: 'Number', value: '1.732' },
      algebraic: {
        ast: { type: 'Number', value: '1.732' },
        degree: 2,
        isolatingInterval: { left: { num: 1n, den: 1n }, right: { num: 2n, den: 1n } },
        polyCoeffsRat: [{ num: -3n, den: 1n }, { num: 0n, den: 1n }, { num: 1n, den: 1n }] // x^2 - 3
      }
    };
    // Initially both isolating intervals are [1, 2], so they overlap.
    // exactCompare should refine them and return -1 (sqrt(2) < sqrt(3))
    const cmp = SetEngine.exactCompare(algSqrt2, algSqrt3);
    expect(cmp).toBe(-1);
  });
});
