import { RuleBase, RuleNode, FuzzifiedVariable, RuleEvaluation, HedgeType, RuleDiagnostics, RuleEngineConfig } from './rule_types';

export class RuleEngine {
  constructor(private ruleBase: RuleBase, private config: RuleEngineConfig = { tNorm: 'min', tConorm: 'max', domainPolicy: 'reject' }) {}

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

  public fuzzify(crispInputs: Record<string, number>): Record<string, FuzzifiedVariable> {
    const result: Record<string, FuzzifiedVariable> = {};
    for (const [varName, crispVal] of Object.entries(crispInputs)) {
      const variable = this.ruleBase.variables[varName];
      if (!variable) continue;
      
      // Enforce configured variable domain
      let boundedVal = crispVal;
      const policy = this.config.domainPolicy ?? 'reject';
      
      if (crispVal < variable.domain[0] || crispVal > variable.domain[1]) {
        if (policy === 'reject') {
          throw new Error(\outside_domain: Variable '\' value \ is outside universe [\, \]\);
        }
        boundedVal = Math.max(variable.domain[0], Math.min(variable.domain[1], crispVal));
      }
      
      const terms: Record<string, { term: string, membership: number }> = {};
      const activeTerms: string[] = [];
      
      for (const [termName, termDef] of Object.entries(variable.terms)) {
        let mem = this.evalMembership(boundedVal, termDef.membership.type, termDef.membership.params);
        mem = Math.max(0, Math.min(1, mem)); // Strict [0,1] clamp
        terms[termName] = { term: termName, membership: mem };
        if (mem > 0) activeTerms.push(termName);
      }
      
      result[varName] = { variable: varName, crispInput: boundedVal, terms, activeTerms };
    }
    return result;
  }

  private applyHedge(value: number, hedge: HedgeType): number {
    if (hedge === 'very') return value * value;
    if (hedge === 'somewhat' || hedge === 'more-or-less') return Math.sqrt(value);
    return value;
  }

    private evaluateNode(node: RuleNode, fuzzified: Record<string, FuzzifiedVariable>, trace: any[]): number {
    if (node.type === 'predicate') {
      const v = fuzzified[node.variable];
      if (!v) throw new Error(\Undefined variable in input: \\);
      const t = v.terms[node.term];
      if (!t) throw new Error(\Undefined term: \ for variable \\);
      
      const originalMem = t.membership;
      const mem = this.applyHedge(originalMem, node.hedge);
      
      let traceDesc = \\ IS \\\;
      if (node.hedge === 'very') {
          traceDesc += \ -> very(\) = \^2 = \\;
      } else if (node.hedge === 'somewhat' || node.hedge === 'more-or-less') {
          traceDesc += \ -> \(\) = sqrt(\) = \\;
      }
      
      trace.push({ step: 'Predicate', desc: traceDesc, value: mem });
      return mem;
    }
    
    if (node.type === 'AND') {
      const vals = node.children.map(c => this.evaluateNode(c, fuzzified, trace));
      const res = this.config.tNorm === 'product' 
        ? vals.reduce((a, b) => a * b, 1.0)
        : Math.min(...vals);
      trace.push({ step: 'AND', desc: \\(\)\, value: res });
      return res;
    }
    
    if (node.type === 'OR') {
      const vals = node.children.map(c => this.evaluateNode(c, fuzzified, trace));
      let res = 0;
      if (this.config.tConorm === 'prob_sum') {
        res = vals.reduce((a, b) => a + b - a * b, 0);
      } else {
        res = Math.max(...vals);
      }
      trace.push({ step: 'OR', desc: \\(\)\, value: res });
      return res;
    }
    
    if (node.type === 'NOT') {
      const val = this.evaluateNode(node.children[0], fuzzified, trace);
      const res = 1.0 - val;
      trace.push({ step: 'NOT', desc: \1 - \\, value: res });
      return res;
    }
    
    return 0;
  }
public evaluateRules(fuzzified: Record<string, FuzzifiedVariable>): RuleEvaluation[] {
    const evals: RuleEvaluation[] = [];
    for (const rule of this.ruleBase.rules) {
      if (rule.weight < 0 || rule.weight > 1) {
         throw new Error(\Rule weight must be in [0,1], got \\);
      }
      const trace: any[] = [];
      const strength = this.evaluateNode(rule.antecedent, fuzzified, trace);
      const finalStrength = strength * (rule.weight ?? 1.0);
      
      evals.push({
        ruleId: rule.id,
        firingStrength: finalStrength,
        consequents: rule.consequents.map(c => ({
          variable: c.variable,
          term: c.term,
          hedge: c.hedge,
          weight: rule.weight ?? 1.0
        })),
        trace
      });
    }
    return evals;
  }

  public analyzeDiagnostics(): RuleDiagnostics {
    const duplicates: [string, string][] = [];
    const contradictions: [string, string][] = [];
    const undefinedVariables = new Set<string>();
    const undefinedTerms = new Set<string>();
    
    const checkNode = (node: RuleNode) => {
      if (node.type === 'predicate') {
        if (!this.ruleBase.variables[node.variable]) undefinedVariables.add(node.variable);
        else if (!this.ruleBase.variables[node.variable].terms[node.term]) undefinedTerms.add(node.term);
      } else {
        node.children.forEach(checkNode);
      }
    };

    for (let i = 0; i < this.ruleBase.rules.length; i++) {
      const r1 = this.ruleBase.rules[i];
      checkNode(r1.antecedent);
      r1.consequents.forEach(c => checkNode(c as unknown as RuleNode)); // hack for struct validation
      
      for (let j = i + 1; j < this.ruleBase.rules.length; j++) {
        const r2 = this.ruleBase.rules[j];
        if (JSON.stringify(r1.antecedent) === JSON.stringify(r2.antecedent)) {
          if (JSON.stringify(r1.consequents) === JSON.stringify(r2.consequents)) {
            duplicates.push([r1.id, r2.id]);
          } else {
            contradictions.push([r1.id, r2.id]);
          }
        }
      }
    }
    return { 
      duplicates, 
      contradictions, 
      unreferencedVariables: [], 
      unreferencedTerms: [],
      undefinedVariables: Array.from(undefinedVariables),
      undefinedTerms: Array.from(undefinedTerms)
    };
  }
}




