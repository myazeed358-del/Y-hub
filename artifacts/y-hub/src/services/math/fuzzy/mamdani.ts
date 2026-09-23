import { MamdaniInferenceRequest, MamdaniInferenceResult, MamdaniOutputResult, MamdaniImplicatedOutput } from './mamdani_types';
import { RuleEngine } from './rule_engine';
import { DefuzzificationEngine } from './defuzzification';

export class MamdaniEngine {
  
  // Re-implemented evalMembership to evaluate output universes (same geometric rules as F1/F7)
  private evalMembership(x: number, m_type: string, params: Record<string, number>): number {
    if (m_type === 'triangle') {
      const { a, b, c } = params;
      if (x <= a || x >= c) return 0;
      if (x === b) return 1;
      return x < b ? (x - a) / (b - a) : (c - x) / (c - b);
    }
    if (m_type === 'trapezoid') {
      const { a, b, c, d } = params;
      if (x <= a || x >= d) return 0;
      if (x >= b && x <= c) return 1;
      return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
    }
    if (m_type === 'gaussian') {
      const { center, sigma } = params;
      return Math.exp(-0.5 * Math.pow((x - center) / sigma, 2));
    }
    return 0;
  }

  public execute(req: MamdaniInferenceRequest): MamdaniInferenceResult {
    const trace: any[] = [];
    const warnings: string[] = [];
    
    // Step 1: Input Validation & Engine Configuration
    if (!req.config) throw new Error('Mamdani configuration missing');
        let resolution = req.config.outputResolution || 1000;
    if (resolution > 10000) resolution = 10000; // Unbounded execution limit
    
    const ruleEngine = new RuleEngine(req.ruleBase, req.config);
    const defuzzEngine = new DefuzzificationEngine();
    
    // Step 2 & 3: Fuzzification & Rule Firing (Handled by F7 Rule Engine)
    trace.push({ step: 'Inference', desc: 'Starting Mamdani pipeline' });
    const fuzzified = ruleEngine.fuzzify(req.inputs);
    const ruleEvaluations = ruleEngine.evaluateRules(fuzzified);
    
    const outputs: Record<string, MamdaniOutputResult> = {};
    let globalStatus = 'success';
    
    // Validate output boundaries and calculate discrete universes
    for (const [varName, outVar] of Object.entries(req.outputVariables)) {
      const minX = outVar.domain[0];
      const maxX = outVar.domain[1];
      const stepX = (maxX - minX) / (resolution - 1);
      
      const xSpace = new Float64Array(resolution);
      for (let i = 0; i < resolution; i++) {
        xSpace[i] = minX + i * stepX;
      }
      
      // We will track the aggregated Y array, initialized to 0
      const aggY = new Float64Array(resolution);
      const implications: MamdaniImplicatedOutput[] = [];
      
      // Step 4 & 5: Evaluate Consequents & Apply Implication
      for (const evalResult of ruleEvaluations) {
        if (evalResult.firingStrength <= 0) continue; // Rule did not fire
        
        for (const consequent of evalResult.consequents) {
          if (consequent.variable !== varName) continue; // Consequent applies to another output variable
          
          const term = outVar.terms[consequent.term];
          if (!term) throw new Error(\Undefined output term \ for variable \\);
          
          const impPoints: {x: number, y: number}[] = [];
          
          // Evaluate over discrete domain
          for (let i = 0; i < resolution; i++) {
            const x = xSpace[i];
            let baseMu = this.evalMembership(x, term.membership.type, term.membership.params);
            
            // F7 Hedges applied to output membership functions as well
            if (consequent.hedge === 'very') baseMu = baseMu * baseMu;
            if (consequent.hedge === 'somewhat' || consequent.hedge === 'more-or-less') baseMu = Math.sqrt(baseMu);
            
            // Implication
            let finalMu = 0;
            if (req.config.implicationMethod === 'clipping') {
              finalMu = Math.min(evalResult.firingStrength, baseMu);
            } else if (req.config.implicationMethod === 'scaling') {
              finalMu = evalResult.firingStrength * baseMu;
            }
            finalMu = Math.max(0, Math.min(1, finalMu)); // strict [0,1] preservation
            
            impPoints.push({ x, y: finalMu });
            
            // Step 6: Aggregation (Max)
            // config ensures 'max' for F8
            aggY[i] = Math.max(aggY[i], finalMu);
          }
          
          implications.push({
             ruleId: evalResult.ruleId,
             variable: varName,
             term: consequent.term,
             points: impPoints
          });
        }
      }
      
      // Finalize Aggregated Set
      const aggPoints = [];
      for (let i = 0; i < resolution; i++) {
        aggPoints.push({ x: xSpace[i], y: aggY[i] });
      }
      
      // Step 7: Defuzzification (F6 integration)
      const defuzzResult = defuzzEngine.executeDiscrete(aggPoints, req.config.defuzzificationMethod, 'aggregated_set');
      
      let outStatus = defuzzResult.status;
      if (outStatus !== 'success') globalStatus = outStatus;
      
      // Output Domain Validation
      let finalCrisp = defuzzResult.value;
      if (finalCrisp < minX || finalCrisp > maxX) {
         outStatus = 'invalid_domain';
         globalStatus = 'invalid_domain';
         warnings.push(\Output \ out of bounds: \\);
      }
      
      trace.push({ step: 'Defuzzification', desc: \Output \ \ = \\});
      
      outputs[varName] = {
        variable: varName,
        defuzzifiedValue: finalCrisp,
        status: outStatus,
        aggregatedOutput: { variable: varName, points: aggPoints },
        implications
      };
    }
    
    return {
       outputs,
       fuzzification: fuzzified,
       ruleEvaluations,
       provider: 'typescript',
       status: globalStatus,
       mathematicalExactness: 'numerical',
       representationAccuracy: 'sampled',
       verificationStatus: globalStatus === 'success' ? 'verified' : 'failed',
       trace,
       warnings,
       visualizationData: { outputs }
    };
  }
}

