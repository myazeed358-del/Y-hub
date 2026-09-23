import { F9InferenceRequest, F9InferenceResult, F9OutputResult, RuleCrispOutput } from './f9_types';
import { RuleEngine } from './rule_engine';

export class SugenoEngine {

  private evaluatePolynomial(inputs: Record<string, number>, params: Record<string, number>): number {
    let result = params['intercept'] || 0;
    for (const [key, value] of Object.entries(inputs)) {
      const coeffKey = \c_\\;
      if (params[coeffKey] !== undefined) {
        result += params[coeffKey] * value;
      }
    }
    return result;
  }

  public execute(req: F9InferenceRequest): F9InferenceResult {
    const trace: any[] = [];
    const warnings: string[] = [];
    
    const ruleEngine = new RuleEngine(req.ruleBase, req.config);
    
    trace.push({ step: 'Inference', desc: 'Starting Sugeno pipeline' });
    const fuzzified = ruleEngine.fuzzify(req.inputs);
    const ruleEvaluations = ruleEngine.evaluateRules(fuzzified);
    
    const outputs: Record<string, F9OutputResult> = {};
    let globalStatus = 'success';
    
    for (const [varName, outVar] of Object.entries(req.outputVariables)) {
      let numSum = 0;
      let denSum = 0;
      const ruleOutputs: RuleCrispOutput[] = [];
      let outStatus = 'success';
      
      for (const evalResult of ruleEvaluations) {
        if (evalResult.firingStrength <= 0) continue;
        
        for (const consequent of evalResult.consequents) {
          if (consequent.variable !== varName) continue;
          
          const term = outVar.terms[consequent.term];
          if (!term) throw new Error(\Undefined output term \ for variable \\);
          
          let z = 0;
          if (term.membership.type === 'constant') {
            z = term.membership.params['value'];
          } else if (term.membership.type === 'linear') {
            z = this.evaluatePolynomial(req.inputs, term.membership.params);
          } else {
             throw new Error(\Sugeno engine requires 'constant' or 'linear' membership functions. Got \\);
          }
          
          const w = evalResult.firingStrength;
          numSum += w * z;
          denSum += w;
          
          ruleOutputs.push({
             ruleId: evalResult.ruleId,
             variable: varName,
             term: consequent.term,
             firingStrength: w,
             z
          });
        }
      }
      
      let finalCrisp = 0;
      if (denSum === 0) {
        outStatus = 'zero_area';
        globalStatus = 'zero_area';
      } else {
        finalCrisp = numSum / denSum;
        // Verify output boundaries
        if (finalCrisp < outVar.domain[0] || finalCrisp > outVar.domain[1]) {
           outStatus = 'invalid_domain';
           globalStatus = 'invalid_domain';
           warnings.push(\Output \ out of bounds: \\);
        }
      }
      
      trace.push({ step: 'Defuzzification (Weighted Average)', desc: \Output \ = \ / \ = \\});
      
      outputs[varName] = {
        variable: varName,
        defuzzifiedValue: finalCrisp,
        status: outStatus,
        ruleOutputs
      };
    }
    
    return {
       outputs,
       fuzzification: fuzzified,
       ruleEvaluations,
       provider: 'typescript',
       status: globalStatus,
       mathematicalExactness: 'exact',
       representationAccuracy: 'exact', // Analytical evaluation
       verificationStatus: globalStatus === 'success' ? 'verified' : 'failed',
       trace,
       warnings,
       visualizationData: { outputs }
    };
  }
}
