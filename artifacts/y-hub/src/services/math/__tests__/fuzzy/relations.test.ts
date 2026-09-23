import { FuzzyRelation } from '../../fuzzy/relations';

describe('Fuzzy Relations', () => {
  it('Validates construction bounds', () => {
    expect(() => new FuzzyRelation([[1.5]])).toThrow();
    expect(() => new FuzzyRelation([[-0.1]])).toThrow();
    expect(() => new FuzzyRelation([[1, 2], [1]])).toThrow();
  });

  it('Calculates Inverse', () => {
    const A = new FuzzyRelation([[0.1, 0.2], [0.3, 0.4]]);
    const inv = A.inverse();
    expect(inv.matrix).toEqual([[0.1, 0.3], [0.2, 0.4]]);
  });

  it('Evaluates Properties correctly', () => {
    // Reflexive, symmetric, but maybe not transitive
    const A = new FuzzyRelation([
      [1, 0.8],
      [0.8, 1]
    ]);
    const props = A.analyzeProperties();
    expect(props.reflexive.is).toBe(true);
    expect(props.irreflexive.is).toBe(false);
    expect(props.symmetric.is).toBe(true);
    expect(props.antisymmetric.is).toBe(false);
    expect(props.transitive.is).toBe(true);
    expect(props.isTolerance).toBe(true);
    expect(props.isEquivalence).toBe(true);
  });

  it('Performs Transitive Closure strictly bounded', () => {
    const A = new FuzzyRelation([
      [0, 0.5, 0],
      [0, 0, 0.5],
      [0, 0, 0]
    ]);
    const closure = A.transitiveClosure();
    expect(closure.converged).toBe(true);
    // 0 -> 1 -> 2 => 0 -> 2 with min(0.5, 0.5) = 0.5
    expect(closure.matrix[0][2]).toBe(0.5);
  });
  });

  it('Calculates Max-Product Composition', () => {
    const A = new FuzzyRelation([[0.5, 0.8]]);
    const B = new FuzzyRelation([[0.4], [0.9]]);
    const C = FuzzyRelation.compose(A, B, 'max-product');
    // max(0.5*0.4, 0.8*0.9) = max(0.2, 0.72) = 0.72
    expect(C.matrix[0][0]).toBeCloseTo(0.72, 12);
  });

  it('Calculates Max-Min Composition properly', () => {
    const A = new FuzzyRelation([[0.5, 0.8]]);
    const B = new FuzzyRelation([[0.4], [0.9]]);
    const C = FuzzyRelation.compose(A, B, 'max-min');
    // max(min(0.5,0.4), min(0.8,0.9)) = max(0.4, 0.8) = 0.8
    expect(C.matrix[0][0]).toBe(0.8);
  });

  it('Evaluates Fuzzy Antisymmetry strictly', () => {
    // Standard fuzzy antisymmetry: if i != j, min(R(i,j), R(j,i)) = 0
    const A = new FuzzyRelation([
      [1, 0.5],
      [0.0, 1] // min(0.5, 0) = 0 -> Antisymmetric
    ]);
    expect(A.analyzeProperties().antisymmetric.is).toBe(true);

    const B = new FuzzyRelation([
      [1, 0.5],
      [0.1, 1] // min(0.5, 0.1) = 0.1 -> Not antisymmetric
    ]);
    expect(B.analyzeProperties().antisymmetric.is).toBe(false);
  });

  it('Evaluates Projection and Cylindrical Extension', () => {
    const A = new FuzzyRelation([
      [0.2, 0.8],
      [0.4, 0.5]
    ]);
    const projRows = A.project(0); // project out rows -> max along cols -> [0.4, 0.8]
    expect(projRows).toEqual([0.4, 0.8]);
    
    const ext = FuzzyRelation.cylindricalExtension(projRows, 3, 0);
    // Extends across 3 rows
    expect(ext.matrix).toEqual([
      [0.4, 0.8],
      [0.4, 0.8],
      [0.4, 0.8]
    ]);
  });
});
