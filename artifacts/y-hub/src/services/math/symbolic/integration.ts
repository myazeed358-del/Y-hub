import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { DerivativeEngine } from './derivative';
import { DomainAnalyzer } from '../domain';
import { InequalityEngine } from './inequality';
import { SetEngine } from './sets';
import { Rat } from '../utils/rational';
import { IntegrationRequest, IntegrationResult, IntegrationStatus, VerificationStatus, SubstitutionStep, IntegrationByPartsStep, TrigIdentityStep, TrigSubstitutionStep } from '../types/integration';
import type { IntegrationExecutionContext } from '../types/integration';
import { SubstitutionEngine } from './substitution';
import { TrigIntegrationEngine } from './trig';
import { TrigSubEngine } from './trig_sub';

export class IntegrationEngine {
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private substitutionEngine = new SubstitutionEngine();
  private partsEngine: any; // will initialize in constructor
  private pfEngine: any;
  private trigEngine = new TrigIntegrationEngine();
  private trigSubEngine = new TrigSubEngine();

  // Used to store the top-level substitution step
  private lastSubStep: SubstitutionStep | undefined = undefined;
  private partsSteps: IntegrationByPartsStep[] = [];
  private trigStepsGlobal: TrigIdentityStep[] = [];
  private trigSubStepsGlobal: TrigSubstitutionStep[] = [];

  constructor() {
    // defer require or import to avoid circular dependencies if necessary
    const { PartsEngine } = require('./parts');
    const { PartialFractionsEngine } = require('./partial_fractions');
    this.partsEngine = new PartsEngine();
    this.pfEngine = new PartialFractionsEngine();
  }

  public integrateRequest(req: IntegrationRequest): IntegrationResult {
    const steps: MathStep[] = [];
    
    // Domain Analysis
    const restrictions = this.domainAnalyzer.analyze(req.expression);
    let domainSet = SetEngine.createRealLine();
    for (const r of restrictions) {
       let res;
       if (r.type === 'inverse_trig') {
          // -1 <= u <= 1  <=> u >= -1 AND u <= 1
          const gteq: CanonicalAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '-1' } };
          const lteq: CanonicalAST = { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: { type: 'Number', value: '1' } };
          const s1 = this.inequalityEngine.solve(gteq, req.variable);
          const s2 = this.inequalityEngine.solve(lteq, req.variable);
          if (s1.kind === 'solution_set' && s2.kind === 'solution_set') {
             const intersect = SetEngine.intersection(s1.solution.intervals, s2.solution.intervals);
             domainSet = { intervals: SetEngine.intersection(domainSet.intervals, intersect) };
          }
       } else if (r.type === 'inverse_sec_csc') {
          // u <= -1 OR u >= 1
          const lteq: CanonicalAST = { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: { type: 'Number', value: '-1' } };
          const gteq: CanonicalAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '1' } };
          const s1 = this.inequalityEngine.solve(lteq, req.variable);
          const s2 = this.inequalityEngine.solve(gteq, req.variable);
          if (s1.kind === 'solution_set' && s2.kind === 'solution_set') {
             const union = SetEngine.union(s1.solution.intervals, s2.solution.intervals);
             domainSet = { intervals: SetEngine.intersection(domainSet.intervals, union) };
          }
       } else {
          const ineq: CanonicalAST = { type: 'Inequality', operator: r.type === 'denominator' ? '!=' : (r.type === 'even_root' ? '>=' : '>'), lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
          const solved = this.inequalityEngine.solve(ineq, req.variable);
          if (solved.kind === 'solution_set') {
             domainSet = { intervals: SetEngine.intersection(domainSet.intervals, solved.solution.intervals) };
          }
       }
    }

    try {
      this.lastSubStep = undefined;
      this.partsSteps = [];
      this.trigStepsGlobal = [];
      this.trigSubStepsGlobal = [];
      const antideriv = this.integrate(req.expression, req.variable, steps);
      const verifiedStatus = this.verify(req.expression, antideriv, req.variable);
      
      return {
        request: req,
        status: 'exact_symbolic',
        antiderivative: antideriv,
        domain: domainSet,
        verificationStatus: verifiedStatus,
        substitution: this.lastSubStep,
        parts: this.partsSteps,
        trigSteps: this.trigStepsGlobal,
        trigSubSteps: this.trigSubStepsGlobal,
        steps
      };
    } catch (e) {
      steps.push({
        id: `int_failed_${Date.now()}`,
        title: 'Integration Failed',
        explanation: e instanceof Error ? e.message : 'Unknown integration error'
      });
      return {
        request: req,
        status: 'unresolved',
        antiderivative: null,
        domain: domainSet,
        verificationStatus: 'verification_failed',
        substitution: this.lastSubStep,
        parts: this.partsSteps,
        steps
      };
    }
  }

  public integrate(node: CanonicalAST, variable: string, steps: MathStep[], depth: number = 0, context?: IntegrationExecutionContext): CanonicalAST {
    const simplified = this.simplifier.simplify(node);
    
    // Check max depth & transformations
    if (context) {
        if (context.depth > context.maxDepth) throw new Error('resource_limit');
        if (context.transformationCount > context.maxTransformations) throw new Error('resource_limit');
        if (context.attemptedStrategies.size > context.maxAttempts) throw new Error('resource_limit');
        context.depth++;
    } else if (depth > 10) {
        throw new Error('Maximum integration depth exceeded');
    }

    // Linearity: Sums and Differences
    if (simplified.type === 'Operator' && (simplified.operator === '+' || simplified.operator === '-')) {
       steps.push({ id: `int_linearity_${Date.now()}`, title: 'Sum/Difference Rule', explanation: '∫(f ± g)dx = ∫fdx ± ∫gdx' });
       const res = {
         type: 'Operator',
         operator: simplified.operator,
         args: simplified.args.map(a => this.integrate(a, variable, steps, depth + 1, context))
       } as CanonicalAST;
       if (context) context.depth--;
       return res;
    }

    // Linearity: Constant Extraction
    if (simplified.type === 'Operator' && simplified.operator === '*') {
       const constants: CanonicalAST[] = [];
       const nonConstants: CanonicalAST[] = [];
       for (const arg of simplified.args) {
          if (!ASTUtils.containsVariable(arg, variable)) constants.push(arg);
          else nonConstants.push(arg);
       }
       if (constants.length > 0 && nonConstants.length > 0) {
          steps.push({ id: `int_const_ext_${Date.now()}`, title: 'Constant Extraction', explanation: '∫cf(x)dx = c∫f(x)dx' });
          const cNode = constants.length === 1 ? constants[0] : { type: 'Operator', operator: '*', args: constants } as CanonicalAST;
          const fnNode = nonConstants.length === 1 ? nonConstants[0] : { type: 'Operator', operator: '*', args: nonConstants } as CanonicalAST;
          const res = this.simplifier.simplify({
            type: 'Operator',
            operator: '*',
            args: [cNode, this.integrate(fnNode, variable, steps, depth + 1, context)]
          });
          if (context) context.depth--;
          return res;
       }
    }
    
    // Constant
    if (!ASTUtils.containsVariable(simplified, variable)) {
       steps.push({ id: `int_const_${Date.now()}`, title: 'Constant Rule', explanation: '∫ c dx = c x' });
       if (context) context.depth--;
       return this.simplifier.simplify({ type: 'Operator', operator: '*', args: [simplified, { type: 'Symbol', name: variable }] });
    }

    // Try basic patterns (6A Direct)
    const basic = this.matchBasicPattern(simplified, variable, steps);
    if (basic) {
       if (context) context.depth--;
       return basic;
    }
    
    // Try General U-Substitution (Phase 6B)
    if (!context || !context.activeStrategies.has('6B')) {
       if (context) { context.activeStrategies.add('6B'); context.attemptedStrategies.add('6B'); context.transformationCount++; }
       const subResult = this.substitutionEngine.matchUSubstitution(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6B');
       if (subResult) {
          if (!this.lastSubStep) this.lastSubStep = subResult.subStep;
          if (context) context.depth--;
          return subResult.result;
       }
    }
    
    // Try Trig Integrals (Phase 6E)
    if (!context || !context.activeStrategies.has('6E')) {
       if (context) { context.activeStrategies.add('6E'); context.attemptedStrategies.add('6E'); context.transformationCount++; }
       const trigResult = this.trigEngine.matchTrigIntegral(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6E');
       if (trigResult) {
          this.trigStepsGlobal.push(...trigResult.trigSteps);
          if (context) context.depth--;
          return trigResult.result;
       }
    }

    // Try Trig Substitution (Phase 6F)
    if (!context || !context.activeStrategies.has('6F')) {
       if (context) { context.activeStrategies.add('6F'); context.attemptedStrategies.add('6F'); context.transformationCount++; }
       const trigSubResult = this.trigSubEngine.matchTrigSub(simplified, variable, (n, v, s, d) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6F');
       if (trigSubResult) {
          this.trigSubStepsGlobal.push(trigSubResult.subStep);
          if (context) context.depth--;
          return trigSubResult.result;
       }
    }

    // Try Partial Fractions (Phase 6D)
    if (!context || !context.activeStrategies.has('6D')) {
       if (context) { context.activeStrategies.add('6D'); context.attemptedStrategies.add('6D'); context.transformationCount++; }
       const pfResult = this.pfEngine.matchPartialFractions(simplified, variable, (n: CanonicalAST, v: string, s: MathStep[], d: number) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6D');
       if (pfResult) {
          if (context) context.depth--;
          return pfResult;
       }
    }

    // Try Integration by Parts (Phase 6C)
    if (!context || !context.activeStrategies.has('6C')) {
       if (context) { context.activeStrategies.add('6C'); context.attemptedStrategies.add('6C'); context.transformationCount++; }
       const partsResult = this.partsEngine.matchParts(simplified, variable, (n: CanonicalAST, v: string, s: MathStep[], d: number) => this.integrate(n, v, s, d, context), steps, depth + 1);
       if (context) context.activeStrategies.delete('6C');
       if (partsResult) {
          this.partsSteps.push(partsResult.partsStep);
          if (context) context.depth--;
          return partsResult.result;
       }
    }

    if (context) context.depth--;
    throw new Error('Unsupported integral in Phase 6B/6C/6D/6E/6F.');
  }

  private matchBasicPattern(node: CanonicalAST, variable: string, steps: MathStep[]): CanonicalAST | null {
    // ∫ x dx
    if (node.type === 'Symbol' && node.name === variable) {
       steps.push({ id: `int_power_${Date.now()}`, title: 'Power Rule', explanation: '∫ x dx = x²/2' });
       return { type: 'Operator', operator: '/', args: [
           { type: 'Operator', operator: '^', args: [node, { type: 'Number', value: '2' }] },
           { type: 'Number', value: '2' }
       ]};
    }
    
    // ∫ x^n dx
    if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === variable && node.args[1].type === 'Number') {
       const nRat = Rat.fromString(node.args[1].value);
       if (nRat.num === -1n && nRat.den === 1n) {
          steps.push({ id: `int_ln_${Date.now()}`, title: '1/x Rule', explanation: '∫ 1/x dx = ln|x|' });
          return { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [node.args[0]] }] };
       }
       const np1 = Rat.add(nRat, Rat.fromNumber(1));
       steps.push({ id: `int_power_${Date.now()}`, title: 'Power Rule', explanation: `∫ x^n dx = x^(n+1)/(n+1)` });
       return { type: 'Operator', operator: '/', args: [
           { type: 'Operator', operator: '^', args: [node.args[0], { type: 'Number', value: Rat.toString(np1) }] },
           { type: 'Number', value: Rat.toString(np1) }
       ]};
    }
    
    // ∫ 1/x dx (if formatted as division)
    if (node.type === 'Operator' && node.operator === '/' && node.args[0].type === 'Number' && node.args[0].value === '1') {
       if (node.args[1].type === 'Symbol' && node.args[1].name === variable) {
          steps.push({ id: `int_ln_${Date.now()}`, title: '1/x Rule', explanation: '∫ 1/x dx = ln|x|' });
          return { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [node.args[1]] }] };
       }
       // 1/(1+x^2)
       if (this.isOnePlusXSquared(node.args[1], variable)) {
          steps.push({ id: `int_atan_${Date.now()}`, title: 'Arctangent Rule', explanation: '∫ 1/(1+x²) dx = atan(x)' });
          return { type: 'Function', name: 'atan', args: [{ type: 'Symbol', name: variable }] };
       }
       // 1/sqrt(1-x^2)
       if (node.args[1].type === 'Function' && node.args[1].name === 'sqrt' && this.isOneMinusXSquared(node.args[1].args[0], variable)) {
          steps.push({ id: `int_asin_${Date.now()}`, title: 'Arcsine Rule', explanation: '∫ 1/sqrt(1-x²) dx = asin(x)' });
          return { type: 'Function', name: 'asin', args: [{ type: 'Symbol', name: variable }] };
       }
    }
    
    // ∫ f(x) dx basic functions
    if (node.type === 'Function' && node.args.length === 1 && node.args[0].type === 'Symbol' && node.args[0].name === variable) {
       switch (node.name) {
          case 'sin':
             steps.push({ id: `int_sin_${Date.now()}`, title: 'Sine Rule', explanation: '∫ sin(x) dx = -cos(x)' });
             return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Function', name: 'cos', args: node.args }] };
          case 'cos':
             steps.push({ id: `int_cos_${Date.now()}`, title: 'Cosine Rule', explanation: '∫ cos(x) dx = sin(x)' });
             return { type: 'Function', name: 'sin', args: node.args };
          case 'sec':
             // sec(x) isn't explicitly in the simple list, but sec^2 is
             break;
          case 'exp':
             steps.push({ id: `int_exp_${Date.now()}`, title: 'Exponential Rule', explanation: '∫ e^x dx = e^x' });
             return node;
       }
    }
    
    // ∫ e^x dx as power
    if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === 'e' && node.args[1].type === 'Symbol' && node.args[1].name === variable) {
       steps.push({ id: `int_exp_${Date.now()}`, title: 'Exponential Rule', explanation: '∫ e^x dx = e^x' });
       return node;
    }
    
    // ∫ a^x dx
    if (node.type === 'Operator' && node.operator === '^' && !ASTUtils.containsVariable(node.args[0], variable) && node.args[1].type === 'Symbol' && node.args[1].name === variable) {
       const base = node.args[0];
       let isValidBase = false;
       if (base.type === 'Number') {
          const rat = Rat.fromString(base.value);
          if (rat.num > 0n && (rat.num !== 1n || rat.den !== 1n)) {
             isValidBase = true;
          }
       } else if (base.type === 'Symbol' && base.name === 'e') {
          isValidBase = true;
       }
       if (isValidBase) {
          steps.push({ id: `int_exp_base_${Date.now()}`, title: 'Exponential Rule (Base a)', explanation: '∫ a^x dx = a^x / ln(a)' });
          return { type: 'Operator', operator: '/', args: [
              node,
              { type: 'Function', name: 'ln', args: [base] }
          ]};
       }
    }
    
    // sec^2(x)
    if (this.isSquareOf(node, 'sec', variable)) {
       steps.push({ id: `int_sec2_${Date.now()}`, title: 'Secant Squared Rule', explanation: '∫ sec²(x) dx = tan(x)' });
       return { type: 'Function', name: 'tan', args: [{ type: 'Symbol', name: variable }] };
    }
    // csc^2(x)
    if (this.isSquareOf(node, 'csc', variable)) {
       steps.push({ id: `int_csc2_${Date.now()}`, title: 'Cosecant Squared Rule', explanation: '∫ csc²(x) dx = -cot(x)' });
       return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Function', name: 'cot', args: [{ type: 'Symbol', name: variable }] }] };
    }
    
    // sec(x)tan(x)
    if (this.isProductOfFunctions(node, 'sec', 'tan', variable)) {
       steps.push({ id: `int_sectan_${Date.now()}`, title: 'Secant Tangent Rule', explanation: '∫ sec(x)tan(x) dx = sec(x)' });
       return { type: 'Function', name: 'sec', args: [{ type: 'Symbol', name: variable }] };
    }
    // csc(x)cot(x)
    if (this.isProductOfFunctions(node, 'csc', 'cot', variable)) {
       steps.push({ id: `int_csccot_${Date.now()}`, title: 'Cosecant Cotangent Rule', explanation: '∫ csc(x)cot(x) dx = -csc(x)' });
       return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Function', name: 'csc', args: [{ type: 'Symbol', name: variable }] }] };
    }

    return null;
  }

  private matchChainRule(node: CanonicalAST, variable: string, steps: MathStep[]): CanonicalAST | null {
    // Check f'(x)/f(x)
    if (node.type === 'Operator' && node.operator === '/') {
       const u = node.args[1];
       const du = this.simplifier.simplify(this.derivativeEngine.differentiate(u, variable));
       const num = this.simplifier.simplify(node.args[0]);
       if (this.areEquivalent(num, du, variable)) {
          steps.push({ id: `int_log_chain_${Date.now()}`, title: 'Logarithmic Integration', explanation: '∫ f\'(x)/f(x) dx = ln|f(x)|' });
          return { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [u] }] };
       }
    }
    
    // Check product f'(x) * g(f(x))
    if (node.type === 'Operator' && node.operator === '*') {
       const args = [...node.args];
       for (let i = 0; i < args.length; i++) {
          const uNode = this.extractInnerFunction(args[i]);
          if (!uNode) continue;
          
          const du = this.simplifier.simplify(this.derivativeEngine.differentiate(uNode, variable));
          
          // Form the rest of the product
          const restArgs = args.filter((_, idx) => idx !== i);
          const rest = this.simplifier.simplify(restArgs.length === 1 ? restArgs[0] : { type: 'Operator', operator: '*', args: restArgs });
          
          if (this.areEquivalent(rest, du, variable)) {
             // We found g(u) * du. 
             // What is g(u)? It's args[i]. But args[i] is something like cos(u) or e^u.
             const integratedOuter = this.integrateOuterFunction(args[i], uNode, steps);
             if (integratedOuter) {
                return integratedOuter;
             }
          }
       }
    }
    
    return null;
  }

  private extractInnerFunction(node: CanonicalAST): CanonicalAST | null {
     if (node.type === 'Function' && node.args.length === 1) return node.args[0];
     if (node.type === 'Operator' && node.operator === '^') return node.args[0];
     return null;
  }

  private integrateOuterFunction(node: CanonicalAST, uNode: CanonicalAST, steps: MathStep[]): CanonicalAST | null {
     if (node.type === 'Function' && node.args.length === 1 && ASTUtils.structuralEquals(node.args[0], uNode)) {
        switch (node.name) {
           case 'sin':
              steps.push({ id: `int_chain_sin_${Date.now()}`, title: 'Chain Rule (Sine)', explanation: '∫ sin(u)du = -cos(u)' });
              return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Function', name: 'cos', args: [uNode] }] };
           case 'cos':
              steps.push({ id: `int_chain_cos_${Date.now()}`, title: 'Chain Rule (Cosine)', explanation: '∫ cos(u)du = sin(u)' });
              return { type: 'Function', name: 'sin', args: [uNode] };
           case 'exp':
              steps.push({ id: `int_chain_exp_${Date.now()}`, title: 'Chain Rule (Exp)', explanation: '∫ e^u du = e^u' });
              return node;
        }
     }
     if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === 'e' && ASTUtils.structuralEquals(node.args[1], uNode)) {
        steps.push({ id: `int_chain_exp_${Date.now()}`, title: 'Chain Rule (Exp)', explanation: '∫ e^u du = e^u' });
        return node;
     }
     return null;
  }

  private isSquareOf(node: CanonicalAST, fnName: string, variable: string): boolean {
    if (node.type === 'Operator' && node.operator === '^' && node.args[1].type === 'Number' && node.args[1].value === '2') {
       const base = node.args[0];
       if (base.type === 'Function' && base.name === fnName && base.args[0].type === 'Symbol' && base.args[0].name === variable) {
          return true;
       }
    }
    return false;
  }

  private isProductOfFunctions(node: CanonicalAST, fn1: string, fn2: string, variable: string): boolean {
    if (node.type === 'Operator' && node.operator === '*' && node.args.length === 2) {
       const [a, b] = node.args;
       if (a.type === 'Function' && b.type === 'Function' && a.args[0].type === 'Symbol' && b.args[0].type === 'Symbol' && a.args[0].name === variable && b.args[0].name === variable) {
          if ((a.name === fn1 && b.name === fn2) || (a.name === fn2 && b.name === fn1)) return true;
       }
    }
    return false;
  }

  private isOnePlusXSquared(node: CanonicalAST, variable: string): boolean {
    if (node.type === 'Operator' && node.operator === '+') {
       const hasOne = node.args.some(a => a.type === 'Number' && a.value === '1');
       const hasX2 = node.args.some(a => a.type === 'Operator' && a.operator === '^' && a.args[0].type === 'Symbol' && a.args[0].name === variable && a.args[1].type === 'Number' && a.args[1].value === '2');
       return hasOne && hasX2;
    }
    return false;
  }

  private isOneMinusXSquared(node: CanonicalAST, variable: string): boolean {
    if (node.type === 'Operator' && node.operator === '-') {
       if (node.args[0].type === 'Number' && node.args[0].value === '1') {
          const a = node.args[1];
          if (a.type === 'Operator' && a.operator === '^' && a.args[0].type === 'Symbol' && a.args[0].name === variable && a.args[1].type === 'Number' && a.args[1].value === '2') {
             return true;
          }
       }
    }
    return false;
  }

  private verify(original: CanonicalAST, antideriv: CanonicalAST, variable: string): VerificationStatus {
    try {
      const differentiated = this.derivativeEngine.differentiate(antideriv, variable);
      return this.areEquivalent(original, differentiated, variable) ? 'exactly_equivalent' : 'not_proven';
    } catch {
      return 'verification_failed';
    }
  }

  private areEquivalent(a: CanonicalAST, b: CanonicalAST, variable: string): boolean {
    const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [a, b] });
    if (diff.type === 'Number' && diff.value === '0') return true;
    return ASTUtils.structuralEquals(this.simplifier.simplify(a), this.simplifier.simplify(b));
  }
}
