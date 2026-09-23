import { RuleParser } from '../../fuzzy/rule_parser';
import { RuleEngine } from '../../fuzzy/rule_engine';
import { RuleBase } from '../../fuzzy/rule_types';

describe('Fuzzy Rule Parser', () => {
  const parser = new RuleParser();

  it('Parses IF-THEN simple structure', () => {
    const rule = parser.parseRule('IF temp IS hot THEN fan IS high', 'R1');
    expect(rule.id).toBe('R1');
    expect(rule.antecedent.type).toBe('predicate');
    expect(rule.consequents.length).toBe(1);
    expect(rule.consequents[0].variable).toBe('fan');
  });

  it('Parses AND/OR grouped structure without eval()', () => {
    const rule = parser.parseRule('IF temp IS hot AND ( humidity IS high OR press IS low ) THEN fan IS high');
    expect(rule.antecedent.type).toBe('AND');
    if (rule.antecedent.type === 'AND') {
      expect(rule.antecedent.children[1].type).toBe('OR');
    }
  });

  it('Parses Hedges correctly', () => {
    const rule = parser.parseRule('IF temp IS VERY hot THEN fan IS SOMEWHAT high');
    if (rule.antecedent.type === 'predicate') {
      expect(rule.antecedent.hedge).toBe('very');
    }
    expect(rule.consequents[0].hedge).toBe('somewhat');
  });

  it('Rejects invalid arbitrary text securely', () => {
    expect(() => parser.parseRule('IF temp IS hot AND eval(true) THEN fan IS high')).toThrow();
  });
});

describe('Fuzzy Rule Engine', () => {
  const ruleBase: RuleBase = {
    variables: {
      temp: {
        name: 'temp',
        domain: [0, 100],
        terms: {
          hot: { name: 'hot', membership: { type: 'triangle', params: { a: 50, b: 80, c: 100 } } }
        }
      }
    },
    rules: [
      {
        id: 'R1',
        weight: 1.0,
        antecedent: { type: 'predicate', variable: 'temp', term: 'hot', hedge: 'none' },
        consequents: [{ type: 'predicate', variable: 'fan', term: 'high', hedge: 'none' }]
      },
      {
        id: 'R2',
        weight: 1.0,
        antecedent: { type: 'predicate', variable: 'temp', term: 'hot', hedge: 'very' },
        consequents: [{ type: 'predicate', variable: 'fan', term: 'max', hedge: 'none' }]
      }
    ]
  };

  const engine = new RuleEngine(ruleBase);

  it('Fuzzifies single variables accurately', () => {
    const fuz = engine.fuzzify({ temp: 65 });
    // (65-50)/(80-50) = 15/30 = 0.5
    expect(fuz['temp'].terms['hot'].membership).toBeCloseTo(0.5, 10);
  });

  it('Evaluates rules with hedges', () => {
    const fuz = engine.fuzzify({ temp: 65 });
    const evals = engine.evaluateRules(fuz);
    
    // R1: hot -> 0.5
    expect(evals.find(e => e.ruleId === 'R1')?.firingStrength).toBeCloseTo(0.5, 10);
    // R2: VERY hot -> 0.5^2 = 0.25
    expect(evals.find(e => e.ruleId === 'R2')?.firingStrength).toBeCloseTo(0.25, 10);
  });

  it('Detects duplicate/contradictory rules structurally without firing', () => {
    const badRuleBase = { ...ruleBase, rules: [...ruleBase.rules, ruleBase.rules[0]] };
    const badEngine = new RuleEngine(badRuleBase);
    const diag = badEngine.analyzeDiagnostics();
    expect(diag.duplicates.length).toBeGreaterThan(0);
  });
  });

  it('Verifies AST Precedence (NOT > AND > OR)', () => {
    // A OR B AND NOT C => A OR (B AND (NOT C))
    const rule = parser.parseRule('IF A IS low OR B IS low AND NOT C IS low THEN out IS high');
    const ant = rule.antecedent;
    expect(ant.type).toBe('OR');
    if (ant.type === 'OR') {
      expect(ant.children[1].type).toBe('AND');
      if (ant.children[1].type === 'AND') {
         expect((ant.children[1] as any).children[1].type).toBe('NOT');
      }
    }
  });

  it('Rejects deep nesting to prevent stack overflows', () => {
    let deep = 'A IS high';
    for (let i = 0; i < 55; i++) {
       deep = \( \ AND A IS high ) \;
    }
    expect(() => parser.parseRule(\IF \ THEN B IS low\)).toThrow();
  });
});

describe('Fuzzy Engine Diagnostics & Semantics', () => {
  const ruleBase: RuleBase = {
    variables: {
      temp: {
        name: 'temp',
        domain: [0, 100],
        terms: {
          hot: { name: 'hot', membership: { type: 'triangle', params: { a: 50, b: 80, c: 100 } } }
        }
      }
    },
    rules: [
      {
        id: 'R1',
        weight: 1.0,
        antecedent: { type: 'predicate', variable: 'temp', term: 'hot', hedge: 'somewhat' },
        consequents: [{ type: 'predicate', variable: 'fan', term: 'high', hedge: 'none' }]
      },
      {
        id: 'R2',
        weight: 1.0,
        antecedent: { type: 'predicate', variable: 'temp', term: 'hot', hedge: 'more-or-less' },
        consequents: [{ type: 'predicate', variable: 'fan', term: 'high', hedge: 'none' }]
      }
    ]
  };

  it('Enforces variable boundaries [0, 100]', () => {
    const engine = new RuleEngine(ruleBase);
    const fuz = engine.fuzzify({ temp: 150 });
    // Should clamp to 100
    expect(fuz['temp'].crispInput).toBe(100);
    // At x=100, hot is 0 (or approaches 0) for the triangle 50, 80, 100
    expect(fuz['temp'].terms['hot'].membership).toBe(0);
  });

  it('Evaluates somewhat and more-or-less consistently as sqrt(x)', () => {
    // Both hedges explicitly demand Math.sqrt() in TS & Python
    const engine = new RuleEngine(ruleBase);
    const fuz = engine.fuzzify({ temp: 65 }); // x=65 -> mem=0.5
    const evalsR1 = engine.evaluateRules(fuz).filter(r => r.ruleId === 'R1');
    const evalsR2 = engine.evaluateRules(fuz).filter(r => r.ruleId === 'R2');
    
    expect(evalsR1[0].firingStrength).toBeCloseTo(Math.sqrt(0.5) * 1.0, 8); // somewhat
    expect(evalsR2[0].firingStrength).toBeCloseTo(Math.sqrt(0.5) * 1.0, 8); // more-or-less (rule 2 weight changed back to 1.0 for this test)
  }); // x=65 -> mem=0.5
    const evals = engine.evaluateRules(fuz).filter(r => r.ruleId === 'R1');
    expect(evals[0].firingStrength).toBeCloseTo(Math.sqrt(0.5), 8);
  });

  it('Throws on invalid rule weight', () => {
    const badEngine = new RuleEngine({
      ...ruleBase,
      rules: [{ ...ruleBase.rules[0], weight: 1.5 }]
    });
    const fuz = badEngine.fuzzify({ temp: 65 });
    expect(() => badEngine.evaluateRules(fuz)).toThrow(/Rule weight must be in \[0,1\]/);
  });
    expect(() => engine.evaluateRules(fuz)).toThrow(/Rule weight must be in \[0,1\]/);
  });
  });

  it('Evaluates VERY hedge boundary and intermediate values exactly as x^2', () => {
    const engine = new RuleEngine(ruleBase);
    const applyHedge = (engine as any).applyHedge.bind(engine);
    
    // Boundary Preservation
    expect(applyHedge(0, 'very')).toBe(0);
    expect(applyHedge(1, 'very')).toBe(1);
    
    // Intermediate
    expect(applyHedge(0.5, 'very')).toBe(0.25);
  });

  it('Evaluates SOMEWHAT and MORE-OR-LESS hedge boundaries and intermediate values exactly as sqrt(x)', () => {
    const engine = new RuleEngine(ruleBase);
    const applyHedge = (engine as any).applyHedge.bind(engine);
    
    // Boundary Preservation
    expect(applyHedge(0, 'somewhat')).toBe(0);
    expect(applyHedge(1, 'somewhat')).toBe(1);
    expect(applyHedge(0, 'more-or-less')).toBe(0);
    expect(applyHedge(1, 'more-or-less')).toBe(1);
    
    // Intermediate 
    expect(applyHedge(0.5, 'somewhat')).toBeCloseTo(0.70710678, 8);
    expect(applyHedge(0.5, 'more-or-less')).toBeCloseTo(0.70710678, 8);
  });

  it('Trace explicitly shows hedge transformations mathematically', () => {
    const engine = new RuleEngine(ruleBase);
    const fuz = engine.fuzzify({ temp: 65 }); // x=65 -> mem=0.5
    const evalsR1 = engine.evaluateRules(fuz).filter(r => r.ruleId === 'R1');
    const evalsR2 = engine.evaluateRules(fuz).filter(r => r.ruleId === 'R2');
    
    // Trace should explicitly detail sqrt(0.5) = 0.707...
    const trace1 = evalsR1[0].trace[0].desc;
    expect(trace1).toMatch(/somewhat\(0\.5\)\s*=\s*sqrt\(0\.5\)\s*=\s*0\.707106/);

    const trace2 = evalsR2[0].trace[0].desc;
    expect(trace2).toMatch(/more-or-less\(0\.5\)\s*=\s*sqrt\(0\.5\)\s*=\s*0\.707106/);
  });
});
