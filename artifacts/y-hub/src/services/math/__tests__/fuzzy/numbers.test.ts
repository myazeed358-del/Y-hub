import { TriangularFuzzyNumber, TrapezoidalFuzzyNumber } from '../../fuzzy/numbers';

describe('Fuzzy Numbers', () => {
  it('TFN: evaluation', () => {
    const tfn = new TriangularFuzzyNumber(1, 2, 3);
    expect(tfn.evaluate(1)).toBe(0);
    expect(tfn.evaluate(2)).toBe(1);
    expect(tfn.evaluate(1.5)).toBe(0.5);
  });

  it('TFN: alpha-cuts and nestedness', () => {
    const tfn = new TriangularFuzzyNumber(1, 2, 3);
    const cut1 = tfn.getAlphaCut(0.2).interval;
    const cut2 = tfn.getAlphaCut(0.8).interval;
    // a2 > a1 implies A_(a2) subseteq A_(a1)
    expect(cut2.lower).toBeGreaterThanOrEqual(cut1.lower);
    expect(cut2.upper).toBeLessThanOrEqual(cut1.upper);
  });

  it('TFN: properties', () => {
    const tfn = new TriangularFuzzyNumber(1, 2, 3);
    expect(tfn.isNormal()).toBe(true);
    expect(tfn.isConvex()).toBe(true);
    expect(tfn.getCore().lower).toBe(2);
    expect(tfn.getCore().upper).toBe(2);
    expect(tfn.getSupport().lower).toBe(1);
    expect(tfn.getSupport().upper).toBe(3);
  });

  it('TrFN: alpha-cuts', () => {
    const trfn = new TrapezoidalFuzzyNumber(1, 2, 3, 4);
    const cut1 = trfn.getAlphaCut(1).interval; // core
    expect(cut1.lower).toBe(2);
    expect(cut1.upper).toBe(3);
    
    const strongCut = trfn.getStrongAlphaCut(0);
    expect(strongCut.isStrong).toBe(true);
  });
});
