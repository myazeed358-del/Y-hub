import { TsukamotoEngine } from '../../fuzzy/tsukamoto';
import { F9InferenceRequest } from '../../fuzzy/f9_types';

describe('Tsukamoto Fuzzy Inference Engine', () => {
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
          // Monotonic up: a=20, b=80. w=0.5 -> z = 20 + 0.5*(80-20) = 50.
          low: { name: 'low', membership: { type: 'monotonic_up', params: { a: 20, b: 80 } } }
        }
      }
    },
    config: { tNorm: 'min', tConorm: 'max', domainPolicy: 'reject' }
  };

  const engine = new TsukamotoEngine();

  it('Executes Tsukamoto monotonic_up inference properly', () => {
    const res = engine.execute(req);
    const fanOutput = res.outputs['fan'];
    
    expect(fanOutput.defuzzifiedValue).toBeCloseTo(50, 5);
    expect(fanOutput.ruleOutputs.length).toBe(1);
    expect(fanOutput.ruleOutputs[0].z).toBeCloseTo(50, 5);
  });
  
  it('Executes Tsukamoto monotonic_down inference properly', () => {
    const downReq = { ...req };
    // Monotonic down: a=20, b=80. w=0.5 -> z = 80 - 0.5*(80-20) = 50.
    downReq.outputVariables['fan'].terms['low'].membership = { type: 'monotonic_down', params: { a: 20, b: 80 } };
    const res = engine.execute(downReq);
    expect(res.outputs['fan'].defuzzifiedValue).toBeCloseTo(50, 5);
  });
});
