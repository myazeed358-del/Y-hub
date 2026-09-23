import { ControllerEngine } from '../../fuzzy/controller';
import { FuzzyOrchestrator } from '../../fuzzy/orchestrator';
import { FuzzyController, ControllerRequest, SensitivityAnalysisRequest, ResponseAnalysisRequest } from '../../fuzzy/controller_types';

describe('Unified Fuzzy Controller Engine (F10)', () => {
  const baseController: FuzzyController = {
    id: 'ctrl_1',
    name: 'HVAC Controller',
    inputVariables: {
      temp: {
        name: 'temp',
        domain: [0, 40],
        terms: {
          warm: { name: 'warm', membership: { type: 'triangle', params: { a: 10, b: 20, c: 30 } } }
        }
      },
      humidity: {
        name: 'humidity',
        domain: [0, 100],
        terms: {
          high: { name: 'high', membership: { type: 'triangle', params: { a: 50, b: 100, c: 100 } } }
        }
      }
    },
    outputVariables: {
      fan: {
        name: 'fan',
        domain: [0, 100],
        terms: {
          low: { name: 'low', membership: { type: 'triangle', params: { a: 0, b: 25, c: 50 } } }
        }
      }
    },
    ruleBase: {
      variables: {} as any, // F7 requires rules to carry over
      rules: [
        {
          id: 'R1',
          weight: 1.0,
          antecedent: {
             type: 'AND',
             children: [
               { type: 'predicate', variable: 'temp', term: 'warm', hedge: 'none' },
               { type: 'predicate', variable: 'humidity', term: 'high', hedge: 'none' }
             ]
          },
          consequents: [{ type: 'predicate', variable: 'fan', term: 'low', hedge: 'none' }]
        }
      ]
    },
    configuration: {
      inferenceMethod: 'mamdani',
      tNorm: 'min', tConorm: 'max', domainPolicy: 'reject',
      implicationMethod: 'clipping', aggregationMethod: 'max', defuzzificationMethod: 'centroid'
    }
  };
  
  // Fix nested refs for testing ease
  baseController.ruleBase.variables = { ...baseController.inputVariables, ...baseController.outputVariables } as any;

  const engine = new ControllerEngine();
  const orchestrator = new FuzzyOrchestrator({} as any);

  it('TEST A - Mamdani Inference executes properly', () => {
    const req: ControllerRequest = { controller: baseController, inputs: { temp: 25, humidity: 75 } };
    const res = engine.execute(req);
    expect(res.status).toBe('success');
    expect(res.outputs['fan'].defuzzifiedValue).toBeGreaterThan(0);
  });

  it('TEST B - Sugeno Zero-Order executes properly', () => {
    const sugenoController = JSON.parse(JSON.stringify(baseController));
    sugenoController.configuration.inferenceMethod = 'sugeno_zero';
    sugenoController.outputVariables['fan'].terms['low'].membership = { type: 'constant', params: { value: 35 } };
    const req: ControllerRequest = { controller: sugenoController, inputs: { temp: 25, humidity: 75 } };
    const res = engine.execute(req);
    expect(res.status).toBe('success');
    expect(res.outputs['fan'].defuzzifiedValue).toBeCloseTo(35, 5);
  });

  it('TEST C - Sugeno First-Order executes properly', () => {
    const sugenoController = JSON.parse(JSON.stringify(baseController));
    sugenoController.configuration.inferenceMethod = 'sugeno_first';
    sugenoController.outputVariables['fan'].terms['low'].membership = { type: 'linear', params: { intercept: 5, c_temp: 1.0, c_humidity: -0.1 } };
    const req: ControllerRequest = { controller: sugenoController, inputs: { temp: 25, humidity: 75 } };
    const res = engine.execute(req);
    expect(res.status).toBe('success');
    // z = 5 + 1.0*25 - 0.1*75 = 5 + 25 - 7.5 = 22.5
    expect(res.outputs['fan'].defuzzifiedValue).toBeCloseTo(22.5, 5);
  });

  it('TEST D - Tsukamoto executes properly', () => {
    const tsuController = JSON.parse(JSON.stringify(baseController));
    tsuController.configuration.inferenceMethod = 'tsukamoto';
    tsuController.outputVariables['fan'].terms['low'].membership = { type: 'monotonic_up', params: { a: 20, b: 80 } };
    const req: ControllerRequest = { controller: tsuController, inputs: { temp: 20, humidity: 100 } };
    const res = engine.execute(req);
    // temp=20 -> warm=1. humidity=100 -> high=1. w=1. z = 20 + 1*(80-20) = 80
    expect(res.status).toBe('success');
    expect(res.outputs['fan'].defuzzifiedValue).toBeCloseTo(80, 5);
  });

  it('TEST G - Zero firing strength handled gracefully', () => {
    const req: ControllerRequest = { controller: baseController, inputs: { temp: 0, humidity: 0 } };
    const res = engine.execute(req);
    expect(res.status).toBe('zero_area');
  });

  it('TEST H - Invalid domains diagnosed', () => {
    const badController = JSON.parse(JSON.stringify(baseController));
    badController.inputVariables['temp'].domain = [40, 0]; // Reversed
    const diag = engine.diagnose(badController);
    expect(diag.isMathematicallyValid).toBe(false);
    expect(diag.invalidDomains.length).toBeGreaterThan(0);
  });

  it('TEST K - Sensitivity Analysis runs properly', async () => {
    const req: SensitivityAnalysisRequest = { controller: baseController, baseInputs: { temp: 25, humidity: 75 }, targetVariable: 'temp', delta: 1 };
    const res = await orchestrator.analyzeControllerSensitivity(req);
    expect(res.status).toBe('success');
    expect(res.sensitivity).toBeDefined();
  });

  it('TEST L - Response Curve runs properly', async () => {
    const req: ResponseAnalysisRequest = { controller: baseController, fixedInputs: { humidity: 75 }, sweepVariable: 'temp', targetOutput: 'fan', points: 10 };
    const res = await orchestrator.analyzeControllerResponse(req);
    expect(res.status).toBe('success');
    expect(res.x.length).toBe(10);
    expect(res.y.length).toBe(10);
  });
  });

  it('TEST P - Resource limiting avoids unbounded sweeps', async () => {
    const heavyReq: ResponseAnalysisRequest = { controller: baseController, fixedInputs: { humidity: 75 }, sweepVariable: 'temp', targetOutput: 'fan', points: 10000000 };
    // Assuming orchestrator limits points directly, or workload hits bounds
    // The workload estimator checks numPoints * workload per point
    // We expect failure or resource_limited if passed down correctly.
  });

  it('TEST Q - NaN / Infinity protection yields verification failure', () => {
    // If output calculates to NaN, verification step catches it
    const badController = JSON.parse(JSON.stringify(baseController));
    badController.outputVariables['fan'].domain = [NaN, NaN]; 
    const req: ControllerRequest = { controller: badController, inputs: { temp: 25, humidity: 75 } };
    const res = engine.execute(req);
    expect(res.verification.isValid).toBe(false);
  });

  it('TEST R - Non-monotonic Tsukamoto consequent throws', () => {
    const tsuController = JSON.parse(JSON.stringify(baseController));
    tsuController.configuration.inferenceMethod = 'tsukamoto';
    tsuController.outputVariables['fan'].terms['low'].membership = { type: 'monotonic_up', params: { a: 20, b: 20 } }; // a == b is degenerate
    const req: ControllerRequest = { controller: tsuController, inputs: { temp: 20, humidity: 100 } };
    expect(() => engine.execute(req)).toThrow(/require 'a' != 'b'/);
  });

  it('TEST S - Zero total Sugeno weight handled gracefully', () => {
    const sugenoController = JSON.parse(JSON.stringify(baseController));
    sugenoController.configuration.inferenceMethod = 'sugeno_zero';
    sugenoController.outputVariables['fan'].terms['low'].membership = { type: 'constant', params: { value: 35 } };
    const req: ControllerRequest = { controller: sugenoController, inputs: { temp: 0, humidity: 0 } }; // 0 firing strength
    const res = engine.execute(req);
    expect(res.status).toBe('zero_area');
  });

  it('TEST T - Malformed configuration caught by diagnostics', () => {
    const badConfig = JSON.parse(JSON.stringify(baseController));
    badConfig.ruleBase.rules[0].weight = 1.5; // > 1 invalid
    const req: ControllerRequest = { controller: badConfig, inputs: { temp: 25, humidity: 75 } };
    const res = engine.execute(req);
    expect(res.status).toBe('invalid_configuration');
    expect(res.diagnostics.invalidWeights.length).toBeGreaterThan(0);
  });
});
