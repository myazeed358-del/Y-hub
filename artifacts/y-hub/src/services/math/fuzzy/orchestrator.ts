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
}














