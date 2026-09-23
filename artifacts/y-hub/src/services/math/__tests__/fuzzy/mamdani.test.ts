import { MamdaniEngine } from '../../fuzzy/mamdani';
import { MamdaniInferenceRequest } from '../../fuzzy/mamdani_types';

describe('Mamdani Fuzzy Inference Engine Hardening', () => {
  const req: MamdaniInferenceRequest = {
    ruleBase: {
      variables: {
        temp: {
          name: 'temp',
          domain: [0, 40],
          terms: {
            warm: { name: 'warm', membership: { type: 'triangle', params: { a: 10, b: 20, c: 30 } } },
            hot: { name: 'hot', membership: { type: 'triangle', params: { a: 25, b: 40, c: 40 } } }
          }
        }
      },
      rules: [
        {
          id: 'R1',
          weight: 1.0,
          antecedent: { type: 'predicate', variable: 'temp', term: 'warm', hedge: 'none' },
          consequents: [{ type: 'predicate', variable: 'fan', term: 'low', hedge: 'none' }]
        },
        {
          id: 'R2',
          weight: 1.0,
          antecedent: { type: 'predicate', variable: 'temp', term: 'hot', hedge: 'none' },
          consequents: [{ type: 'predicate', variable: 'fan', term: 'high', hedge: 'none' }]
        }
      ]
    },
    inputs: { temp: 28 }, // 28 is between warm (20-30) and hot (25-40)
    outputVariables: {
      fan: {
        name: 'fan',
        domain: [0, 100],
        terms: {
          low: { name: 'low', membership: { type: 'triangle', params: { a: 0, b: 25, c: 50 } } },
          high: { name: 'high', membership: { type: 'triangle', params: { a: 50, b: 100, c: 100 } } }
        }
      }
    },
    config: {
      tNorm: 'min',
      tConorm: 'max',
      domainPolicy: 'reject',
      implicationMethod: 'clipping',
      aggregationMethod: 'max',
      defuzzificationMethod: 'centroid',
      outputResolution: 100
    }
  };

  const engine = new MamdaniEngine();

  it('Canonical Test: Warm/Hot mapping yielding expected defuzzification', () => {
    const res = engine.execute(req);
    
    // A. Membership Values
    // warm=(30-28)/(30-20)=0.2. hot=(28-25)/(40-25)=3/15=0.2.
    expect(res.fuzzification['temp'].terms['warm'].membership).toBeCloseTo(0.2, 5);
    expect(res.fuzzification['temp'].terms['hot'].membership).toBeCloseTo(0.2, 5);
    
    // B. Rule Firing Strengths
    expect(res.ruleEvaluations.find(r => r.ruleId === 'R1')?.firingStrength).toBeCloseTo(0.2, 5);
    expect(res.ruleEvaluations.find(r => r.ruleId === 'R2')?.firingStrength).toBeCloseTo(0.2, 5);
    
    // C. Implicated Output Curves (clipping)
    const fanOutput = res.outputs['fan'];
    const r1Impl = fanOutput.implications.find(i => i.ruleId === 'R1')!;
    const r2Impl = fanOutput.implications.find(i => i.ruleId === 'R2')!;
    
    const r1Max = Math.max(...r1Impl.points.map(p => p.y));
    const r2Max = Math.max(...r2Impl.points.map(p => p.y));
    expect(r1Max).toBeCloseTo(0.2, 5); // Clipped strictly at 0.2
    expect(r2Max).toBeCloseTo(0.2, 5);
    
    // D. Aggregated Output (max)
    const aggMax = Math.max(...fanOutput.aggregatedOutput.points.map(p => p.y));
    expect(aggMax).toBeCloseTo(0.2, 5); // Max of two 0.2 peaks
    
    // E. Defuzzification Result
    expect(fanOutput.defuzzifiedValue).toBeGreaterThan(0);
    expect(fanOutput.defuzzifiedValue).toBeLessThan(100);
    expect(fanOutput.status).toBe('success');
    expect(res.representationAccuracy).toBe('sampled');
  });

  it('Edge Case: Zero-fire condition gracefully returns zero_area', () => {
    const zeroReq: MamdaniInferenceRequest = { ...req, inputs: { temp: 5 } }; // No active terms
    const res = engine.execute(zeroReq);
    expect(res.outputs['fan'].status).toBe('zero_area');
    expect(res.status).toBe('zero_area');
  });

  it('Edge Case: Single-rule firing preserves implication curve exactly into aggregation', () => {
    const singleReq: MamdaniInferenceRequest = { ...req, inputs: { temp: 15 } }; // Only Warm=0.5
    const res = engine.execute(singleReq);
    const fanOutput = res.outputs['fan'];
    
    // Rule 1 is the only active rule, its implication must match aggregation
    const r1Impl = fanOutput.implications.find(i => i.ruleId === 'R1')!;
    for (let i = 0; i < fanOutput.aggregatedOutput.points.length; i++) {
       expect(r1Impl.points[i].y).toBeCloseTo(fanOutput.aggregatedOutput.points[i].y, 5);
    }
  });

  it('Edge Case: Conflicting Output Case survives until aggregation', () => {
    const conflictReq: MamdaniInferenceRequest = { ...req };
    conflictReq.ruleBase.rules[0] = {
      ...conflictReq.ruleBase.rules[0],
      antecedent: { type: 'predicate', variable: 'temp', term: 'warm', hedge: 'none' },
      consequents: [{ type: 'predicate', variable: 'fan', term: 'low', hedge: 'none' }]
    };
    conflictReq.ruleBase.rules[1] = {
      ...conflictReq.ruleBase.rules[1],
      antecedent: { type: 'predicate', variable: 'temp', term: 'warm', hedge: 'none' },
      consequents: [{ type: 'predicate', variable: 'fan', term: 'high', hedge: 'none' }]
    };
    // Input 20 -> Warm = 1.0. Both rules fire 1.0 but request completely contradictory outputs.
    conflictReq.inputs = { temp: 20 };
    
    const res = engine.execute(conflictReq);
    const fanOutput = res.outputs['fan'];
    
    // Both R1 (low) and R2 (high) implications must coexist before aggregation
    expect(fanOutput.implications.length).toBe(2);
    expect(fanOutput.implications.find(i => i.term === 'low')).toBeDefined();
    expect(fanOutput.implications.find(i => i.term === 'high')).toBeDefined();
  });
});
