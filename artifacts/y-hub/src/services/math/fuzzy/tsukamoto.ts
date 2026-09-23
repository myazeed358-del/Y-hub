import { F9InferenceRequest, F9InferenceResult, F9OutputResult, RuleCrispOutput } from './f9_types';
import { RuleEngine } from './rule_engine';

export class TsukamotoEngine {

  private evaluateInverse(w: number, type: string, params: Record<string, number>): number {
    const { a, b } = params;
        if (a === undefined || b === undefined) throw new Error("Monotonic functions require 'a' and 'b' parameters.");
    if (a === b) throw new Error("Monotonic functions require 'a' != 'b'.");
    
    if (type === 'monotonic_up') {
      return a + w * (b - a);
    } else if (type === 'monotonic_down') {
      return b - w * (b - a);
    }
    throw new Error(\Tsukamoto engine requires 'monotonic_up' or 'monotonic_down' membership functions. Got \\);
  }

  public execute(req: F9InferenceRequest): F9InferenceResult {
    const trace: any[] = [];
    const warnings: string[] = [];
    
    const ruleEngine = new RuleEngine(req.ruleBase, req.config);
    
    trace.push({ step: 'Inference', desc: 'Starting Tsukamoto pipeline' });
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
          
          const w = evalResult.firingStrength;
          const z = this.evaluateInverse(w, term.membership.type, term.membership.params);
          
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
       representationAccuracy: 'exact',
       verificationStatus: globalStatus === 'success' ? 'verified' : 'failed',
       trace,
       warnings,
       visualizationData: { outputs }
    };
  }
}

