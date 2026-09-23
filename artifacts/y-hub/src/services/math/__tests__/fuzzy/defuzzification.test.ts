import { DefuzzificationEngine } from '../../fuzzy/defuzzification';

describe('Fuzzy Defuzzification', () => {
  const engine = new DefuzzificationEngine();

  it('Handles centroid properly', () => {
    // Triangle (0, 1, 2)
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
      { x: 1.5, y: 0.5 },
      { x: 2, y: 0 }
    ];
    const res = engine.executeDiscrete(points, 'centroid');
    expect(res.status).toBe('success');
    expect(res.value).toBeCloseTo(1, 10);
  });

  it('Detects zero-area correctly', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    const res = engine.executeDiscrete(points, 'centroid');
    expect(res.status).toBe('zero_area');
  });

  it('Calculates MOM, SOM, LOM correctly over a plateau', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 0 }
    ];
    
    expect(engine.executeDiscrete(points, 'som').value).toBe(1);
    expect(engine.executeDiscrete(points, 'mom').value).toBe(2);
    expect(engine.executeDiscrete(points, 'lom').value).toBe(3);
  });
  
  it('Calculates Bisector correctly', () => {
    // Non-symmetric distribution
    const points = [
      { x: 0, y: 0.2 },
      { x: 1, y: 0.8 }, // total area = 1.0, half = 0.5
      { x: 2, y: 0 }
    ];
    // cumulative: 0.2, 1.0, 1.0 -> target 0.5 -> crosses at index 1 (x=1)
    expect(engine.executeDiscrete(points, 'bisector').value).toBe(1);
  });
  });

  it('Rejects weighted_average for invalid input types', () => {
    const points = [
      { x: 0, y: 0.5 },
      { x: 1, y: 1 }
    ];
    // Not explicitly marked as singletons
    const res = engine.executeDiscrete(points, 'weighted_average');
    expect(res.status).toBe('invalid_domain');
  });

  it('Accepts weighted_average for singletons', () => {
    const points = [
      { x: 2, y: 0.5 },
      { x: 6, y: 1 }
    ];
    // Labeled singletons
    const res = engine.executeDiscrete(points, 'weighted_average', 'singletons');
    expect(res.status).toBe('success');
    expect(res.value).toBeCloseTo((2*0.5 + 6*1)/1.5, 10);
  });
});
