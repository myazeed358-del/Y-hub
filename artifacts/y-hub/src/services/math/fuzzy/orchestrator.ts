import { FuzzyInferenceRequest, FuzzyResult } from './types';
import { FuzzyInferenceEngine } from './inference';
import { FuzzyAdapter } from '../python/FuzzyAdapter';
import { DefuzzificationEngine } from './defuzzification';
import { RuleEngine } from './rule_engine';
import { RuleEngineConfig } from './rule_types';
import { MamdaniEngine } from './mamdani';
import { MamdaniInferenceRequest } from './mamdani_types';
import { F9InferenceRequest } from './f9_types';
import { SugenoEngine } from './sugeno';
import { TsukamotoEngine } from './tsukamoto';
import { ControllerEngine } from './controller';
import { ControllerRequest, SensitivityAnalysisRequest, ResponseAnalysisRequest } from './controller_types';

export class FuzzyOrchestrator {
  private tsEngine = new FuzzyInferenceEngine();
  private adapter = new FuzzyAdapter();
  private controllerEngine = new ControllerEngine();

  private isHeavy(req: FuzzyInferenceRequest): boolean {
    // Large number of rules or numerical intensive requirements
    if (req.rules && req.rules.length > 50) return true;
    return false;
  }

  public async orchestrateAsync(req: FuzzyInferenceRequest): Promise<FuzzyResult> {
    if (!this.isHeavy(req)) {
      const tsRes = this.tsEngine.executeFastPath(req);
      if (tsRes) return tsRes;
    }

    // Heavy Path or TS failed
    const pyRes = await this.adapter.executePythonFuzzy(req);
    if (pyRes) return pyRes;

    // Fallback to TS if Python unavailable
    const fallbackRes = this.tsEngine.executeFastPath(req);
    if (fallbackRes) {
      fallbackRes.provider = 'fallback_typescript';
      return fallbackRes;
    }

    return {
      crispOutputs: {},
      provider: 'fallback_typescript',
      exactness: 'numerical_approximation',
      verificationStatus: 'verification_failed',
      trace: [],
      warnings: ['Both Python and TS engines failed.']
    };
  }

  public async analyzeControllerSensitivity(req: SensitivityAnalysisRequest): Promise<any> {
    const variable = req.controller.inputVariables[req.targetVariable];

    if (!variable) {
      return {
        status: 'invalid_request',
        sensitivity: {},
        warnings: [`Unknown input variable '${req.targetVariable}'.`]
      };
    }

    if (!Number.isFinite(req.delta) || req.delta <= 0) {
      return {
        status: 'invalid_request',
        sensitivity: {},
        warnings: ['Sensitivity delta must be a positive finite number.']
      };
    }

    const baseX = req.baseInputs[req.targetVariable];

    if (!Number.isFinite(baseX)) {
      return {
        status: 'invalid_request',
        sensitivity: {},
        warnings: [`Missing or invalid base input '${req.targetVariable}'.`]
      };
    }

    const [domainMin, domainMax] = variable.domain;
    const xMinus = Math.max(domainMin, baseX - req.delta);
    const xPlus = Math.min(domainMax, baseX + req.delta);

    if (xPlus === xMinus) {
      return {
        status: 'invalid_request',
        sensitivity: {},
        warnings: ['Sensitivity interval collapsed at the variable domain boundary.']
      };
    }

    const baseResult = this.controllerEngine.execute({
      controller: req.controller,
      inputs: { ...req.baseInputs }
    });

    const minusResult = this.controllerEngine.execute({
      controller: req.controller,
      inputs: {
        ...req.baseInputs,
        [req.targetVariable]: xMinus
      }
    });

    const plusResult = this.controllerEngine.execute({
      controller: req.controller,
      inputs: {
        ...req.baseInputs,
        [req.targetVariable]: xPlus
      }
    });

    const sensitivity: Record<string, number> = {};

    for (const outputName of Object.keys(req.controller.outputVariables)) {
      const yMinus = minusResult.outputs?.[outputName]?.defuzzifiedValue;
      const yPlus = plusResult.outputs?.[outputName]?.defuzzifiedValue;

      if (
        Number.isFinite(yMinus) &&
        Number.isFinite(yPlus)
      ) {
        sensitivity[outputName] =
          (yPlus - yMinus) / (xPlus - xMinus);
      }
    }

    return {
      status: 'success',
      sensitivity,
      baseResult,
      samples: {
        minus: {
          x: xMinus,
          result: minusResult
        },
        plus: {
          x: xPlus,
          result: plusResult
        }
      },
      warnings: []
    };
  }

  public async analyzeControllerResponse(req: ResponseAnalysisRequest): Promise<any> {
    const variable = req.controller.inputVariables[req.sweepVariable];

    if (!variable) {
      return {
        status: 'invalid_request',
        x: [],
        y: [],
        warnings: [`Unknown sweep variable '${req.sweepVariable}'.`]
      };
    }

    if (!req.controller.outputVariables[req.targetOutput]) {
      return {
        status: 'invalid_request',
        x: [],
        y: [],
        warnings: [`Unknown target output '${req.targetOutput}'.`]
      };
    }

    if (!Number.isFinite(req.points) || req.points < 2) {
      return {
        status: 'invalid_request',
        x: [],
        y: [],
        warnings: ['Response analysis requires at least 2 points.']
      };
    }

    const points = Math.floor(req.points);
    const MAX_SWEEP_POINTS = 10000;

    if (points > MAX_SWEEP_POINTS) {
      return {
        status: 'resource_limited',
        x: [],
        y: [],
        warnings: [
          `Requested ${points} sweep points; maximum allowed is ${MAX_SWEEP_POINTS}.`
        ]
      };
    }

    const [domainMin, domainMax] = variable.domain;
    const x: number[] = [];
    const y: number[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < points; i++) {
      const sweepValue =
        domainMin +
        ((domainMax - domainMin) * i) /
          (points - 1);

      const result = this.controllerEngine.execute({
        controller: req.controller,
        inputs: {
          ...req.fixedInputs,
          [req.sweepVariable]: sweepValue
        }
      });

      const outputValue =
        result.outputs?.[req.targetOutput]?.defuzzifiedValue;

      x.push(sweepValue);
      y.push(
        Number.isFinite(outputValue)
          ? outputValue
          : NaN
      );

      if (
        result.status !== 'success' &&
        result.status !== 'zero_area'
      ) {
        warnings.push(
          `Sweep point ${i} returned status '${result.status}'.`
        );
      }
    }

    return {
      status: 'success',
      x,
      y,
      warnings
    };
  }

}














