import { SugenoEngine } from '../../fuzzy/sugeno';
import { F9InferenceRequest } from '../../fuzzy/f9_types';

describe('Sugeno Fuzzy Inference Engine', () => {
  const req: F9InferenceRequest = {
    ruleBase: {
      variables: {
        temp: {
          name: 'temp',
          domain: [0, 40],
          terms: {
            warm: { name: 'warm', membership: { type: 'triangle', params: { a: 10, b: 20, c: 30 } } }
          }
        }
      },
      rules: [
        {
          id: 'R1',
          weight: 1.0,
          antecedent: { type: 'predicate', variable: 'temp', term: 'warm', hedge: 'none' },
          consequents: [{ type: 'predicate', variable: 'fan', term: 'low', hedge: 'none' }]
        }
      ]
    },
    inputs: { temp: 25 }, // warm = (30-25)/10 = 0.5
    outputVariables: {
      fan: {
        name: 'fan',
        domain: [0, 100],
        terms: {
          // Linear: z = 0.5 * temp + 10 = 0.5 * 25 + 10 = 12.5 + 10 = 22.5
          low: { name: 'low', membership: { type: 'linear', params: { intercept: 10, c_temp: 0.5 } } }
        }
      }
    },
    config: { tNorm: 'min', tConorm: 'max', domainPolicy: 'reject' }
  };

  const engine = new SugenoEngine();

  it('Executes First-order Sugeno inference properly', () => {
    const res = engine.execute(req);
    const fanOutput = res.outputs['fan'];
    
    // w = 0.5
    // z = 22.5
    // defuzz = (0.5 * 22.5) / 0.5 = 22.5
    expect(fanOutput.defuzzifiedValue).toBeCloseTo(22.5, 5);
    expect(fanOutput.ruleOutputs.length).toBe(1);
    expect(fanOutput.ruleOutputs[0].z).toBeCloseTo(22.5, 5);
  });
  
  it('Executes Zero-order (Constant) Sugeno inference properly', () => {
    const constReq = { ...req };
    constReq.outputVariables['fan'].terms['low'].membership = { type: 'constant', params: { value: 30 } };
    const res = engine.execute(constReq);
    expect(res.outputs['fan'].defuzzifiedValue).toBeCloseTo(30, 5);
  });
});
