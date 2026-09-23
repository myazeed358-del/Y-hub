import { FuzzyController, ControllerRequest, ControllerResult, ControllerDiagnostics, ControllerVerification } from './controller_types';
import { MamdaniEngine } from './mamdani';
import { SugenoEngine } from './sugeno';
import { TsukamotoEngine } from './tsukamoto';
import { MamdaniInferenceRequest } from './mamdani_types';
import { F9InferenceRequest } from './f9_types';

export class ControllerEngine {
  
  public diagnose(controller: FuzzyController): ControllerDiagnostics {
    const diag: ControllerDiagnostics = {
      undefinedVariables: [],
      undefinedTerms: [],
      unreachableRules: [],
      contradictoryRules: [],
      invalidWeights: [],
      invalidDomains: [],
      isMathematicallyValid: true
    };
    
    // Check Domains
    for (const [vName, v] of Object.entries(controller.inputVariables)) {
      if (!v.domain || v.domain.length !== 2 || v.domain[0] >= v.domain[1]) {
        diag.invalidDomains.push(\Input \ has invalid domain: \\);
      }
    }
    for (const [vName, v] of Object.entries(controller.outputVariables)) {
      if (!v.domain || v.domain.length !== 2 || v.domain[0] >= v.domain[1]) {
        diag.invalidDomains.push(\Output \ has invalid domain: \\);
      }
    }

    // Check Rules
    for (const rule of controller.ruleBase.rules) {
      if (rule.weight !== undefined && (rule.weight < 0 || rule.weight > 1)) {
        diag.invalidWeights.push(\Rule \ weight \ out of [0,1]\);
      }
      
      // Simple consequent conflict detection (same rule ID implies simple iteration, but for full contradictory: rule1 and rule2 same antecedent different consequents)
      // Here we just do a basic check
      for (const cons of rule.consequents) {
        if (!controller.outputVariables[cons.variable]) {
          diag.undefinedVariables.push(\Consequent variable \ in Rule \\);
        } else if (!controller.outputVariables[cons.variable].terms[cons.term]) {
          diag.undefinedTerms.push(\Consequent term \ in Rule \\);
        }
      }
    }
    
    if (diag.invalidDomains.length > 0 || diag.invalidWeights.length > 0 || diag.undefinedVariables.length > 0 || diag.undefinedTerms.length > 0) {
      diag.isMathematicallyValid = false;
    }
    
    return diag;
  }

  public verify(result: any, controller: FuzzyController): ControllerVerification {
    const ver: ControllerVerification = { isValid: true, failures: [] };
    
    for (const [vName, out] of Object.entries(result.outputs || {})) {
       const crisp = (out as any).defuzzifiedValue;
       if (crisp === undefined || isNaN(crisp) || !isFinite(crisp)) {
         ver.failures.push(\Output \ is NaN or Infinity.\);
         continue;
       }
       const vDomain = controller.outputVariables[vName].domain;
       if (crisp < vDomain[0] || crisp > vDomain[1]) {
         ver.failures.push(\Output \ value \ exceeds declared domain [\, \].\);
       }
    }
    
    if (ver.failures.length > 0) ver.isValid = false;
    return ver;
  }

  public execute(req: ControllerRequest): ControllerResult {
    const diag = this.diagnose(req.controller);
    if (!diag.isMathematicallyValid) {
      return {
        provider: 'typescript',
        inferenceMethod: req.controller.configuration.inferenceMethod,
        mathematicalExactness: 'numerical',
        representationAccuracy: 'sampled',
        status: 'invalid_configuration',
        warnings: ['Controller configuration failed diagnostics.'],
        diagnostics: diag,
        verification: { isValid: false, failures: ['Did not execute'] },
        outputs: {},
        fuzzification: {},
        ruleEvaluations: [],
        trace: [],
        visualizationData: {}
      };
    }
    
    let engineRes: any;
    let tracePrefix = [{ step: 'Controller', desc: \Executing \ controller \\ }];
    
    try {
      if (req.controller.configuration.inferenceMethod === 'mamdani') {
        const mamdaniReq: MamdaniInferenceRequest = {
          ruleBase: req.controller.ruleBase,
          inputs: req.inputs,
          outputVariables: req.controller.outputVariables,
          config: req.controller.configuration as any
        };
        const engine = new MamdaniEngine();
        engineRes = engine.execute(mamdaniReq);
      } else if (req.controller.configuration.inferenceMethod.startsWith('sugeno')) {
        const f9Req: F9InferenceRequest = {
          ruleBase: req.controller.ruleBase,
          inputs: req.inputs,
          outputVariables: req.controller.outputVariables,
          config: req.controller.configuration as any
        };
        const engine = new SugenoEngine();
        engineRes = engine.execute(f9Req);
      } else if (req.controller.configuration.inferenceMethod === 'tsukamoto') {
        const f9Req: F9InferenceRequest = {
          ruleBase: req.controller.ruleBase,
          inputs: req.inputs,
          outputVariables: req.controller.outputVariables,
          config: req.controller.configuration as any
        };
        const engine = new TsukamotoEngine();
        engineRes = engine.execute(f9Req);
      } else {
        throw new Error(\Unknown inference method \\);
      }
    } catch (e: any) {
      if (e.message && e.message.startsWith('outside_domain')) {
         return {
           provider: 'typescript', inferenceMethod: req.controller.configuration.inferenceMethod,
           mathematicalExactness: 'numerical', representationAccuracy: 'sampled',
           status: 'outside_domain', warnings: [e.message], diagnostics: diag,
           verification: { isValid: false, failures: [e.message] }, outputs: {}, fuzzification: {}, ruleEvaluations: [], trace: [{step: 'Validation', desc: e.message}], visualizationData: {}
         };
      }
      throw e;
    }

    const verification = this.verify(engineRes, req.controller);
    let finalStatus = engineRes.status;
    if (!verification.isValid && finalStatus === 'success') {
      finalStatus = 'verification_failed';
    }

    return {
      provider: 'typescript',
      inferenceMethod: req.controller.configuration.inferenceMethod,
      mathematicalExactness: engineRes.mathematicalExactness,
      representationAccuracy: engineRes.representationAccuracy,
      status: finalStatus,
      warnings: [...(engineRes.warnings || []), ...verification.failures],
      diagnostics: diag,
      verification,
      outputs: engineRes.outputs,
      fuzzification: engineRes.fuzzification,
      ruleEvaluations: engineRes.ruleEvaluations,
      trace: [...tracePrefix, ...engineRes.trace],
      visualizationData: engineRes.visualizationData
    };
  }
}
