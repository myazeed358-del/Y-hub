


import { ControllerEngine } from './controller';
import { SensitivityAnalysisRequest, ResponseAnalysisRequest } from './controller_types';


/** Controller sensitivity and response sampling independent from inference dispatch. */
export class ControllerAnalysisService {
  private controllerEngine = new ControllerEngine();
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
