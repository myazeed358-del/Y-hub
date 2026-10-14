import { FuzzyInferenceRequest, FuzzyResult } from './types';
import { ControllerAnalysisService } from './ControllerAnalysisService';
import { FuzzyInferenceEngine } from './inference';
import { FuzzyAdapter } from '../python/FuzzyAdapter';


import { SensitivityAnalysisRequest, ResponseAnalysisRequest } from './controller_types';

export class FuzzyOrchestrator {
  private controllerAnalysis = new ControllerAnalysisService();
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

  public async analyzeControllerSensitivity(req: SensitivityAnalysisRequest): Promise<any> {
    return this.controllerAnalysis.analyzeControllerSensitivity(req);
  }

  public async analyzeControllerResponse(req: ResponseAnalysisRequest): Promise<any> {
    return this.controllerAnalysis.analyzeControllerResponse(req);
  }

}


