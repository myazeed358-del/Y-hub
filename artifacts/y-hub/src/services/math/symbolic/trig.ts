import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { TrigIdentityStep, VerificationStatus } from '../types/integration';

interface TrigPowers {
  sin: number;
  cos: number;
  tan: number;
  sec: number;
  cot: number;
  csc: number;
}

export class TrigIntegrationEngine {
  private simplifier = new SymbolicSimplifier();

  public matchTrigIntegral(
    integrand: CanonicalAST,
    variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[],
    depth: number
  ): { result: CanonicalAST, trigSteps: TrigIdentityStep[] } | null {
    if (depth > 5) return null; // Resource limit

    const powers = this.extractTrigPowers(integrand, variable);
    if (!powers) return null; // Not a pure trig integral over `variable`

    // Max exponent limit
    if (Math.max(powers.sin, powers.cos, powers.tan, powers.sec, powers.cot, powers.csc) > 8) {
       return null; // Resource limit
    }
    
    // Check fractional or negative powers (unsupported in initial scope, handled as 0 if not present, but if present as negative, extract returns null or negative?
    // Wait, let's only support integers >= 0 for now.
    
    // Sin/Cos family
    if ((powers.sin > 0 || powers.cos > 0) && powers.tan === 0 && powers.sec === 0 && powers.cot === 0 && powers.csc === 0) {
       return this.handleSinCos(powers.sin, powers.cos, variable, integrateFn, steps, depth);
    }

    // Tan/Sec family
    if ((powers.tan > 0 || powers.sec > 0) && powers.sin === 0 && powers.cos === 0 && powers.cot === 0 && powers.csc === 0) {
       return this.handleTanSec(powers.tan, powers.sec, variable, integrateFn, steps, depth);
    }

    // Cot/Csc family
    if ((powers.cot > 0 || powers.csc > 0) && powers.sin === 0 && powers.cos === 0 && powers.tan === 0 && powers.sec === 0) {
       return this.handleCotCsc(powers.cot, powers.csc, variable, integrateFn, steps, depth);
    }

    return null;
  }

  private extractTrigPowers(node: CanonicalAST, variable: string): TrigPowers | null {
     const powers: TrigPowers = { sin: 0, cos: 0, tan: 0, sec: 0, cot: 0, csc: 0 };
     
     const terms = node.type === 'Operator' && node.operator === '*' ? node.args : [node];
     
     for (const term of terms) {
        if (!ASTUtils.containsVariable(term, variable)) continue; // Constant term, let it be handled by linearity
        
        let funcName = '';
        let power = 1;

        if (term.type === 'Function' && term.args.length === 1 && term.args[0].type === 'Symbol' && term.args[0].name === variable) {
           funcName = term.name;
        } else if (term.type === 'Operator' && term.operator === '^' && term.args[1].type === 'Number') {
           const base = term.args[0];
           if (base.type === 'Function' && base.args.length === 1 && base.args[0].type === 'Symbol' && base.args[0].name === variable) {
              funcName = base.name;
              const p = parseFloat(term.args[1].value);
              if (!Number.isInteger(p) || p < 0) return null; // Only non-negative integers supported
              power = p;
           } else {
              return null; // Variable power but not a simple trig function base
           }
        } else {
           return null; // Some other function of variable (e.g. x)
        }

        if (funcName === 'sin') powers.sin += power;
        else if (funcName === 'cos') powers.cos += power;
        else if (funcName === 'tan') powers.tan += power;
        else if (funcName === 'sec') powers.sec += power;
        else if (funcName === 'cot') powers.cot += power;
        else if (funcName === 'csc') powers.csc += power;
        else return null; // Some other function like ln(x)
     }

     return powers;
  }

  private createTrigNode(funcName: string, power: number, variable: string): CanonicalAST {
     const base: CanonicalAST = { type: 'Function', name: funcName, args: [{ type: 'Symbol', name: variable }] };
     if (power === 1) return base;
     return { type: 'Operator', operator: '^', args: [base, { type: 'Number', value: power.toString() }] };
  }

  private multiplyASTs(nodes: CanonicalAST[]): CanonicalAST {
     const valid = nodes.filter(n => !(n.type === 'Number' && n.value === '1'));
     if (valid.length === 0) return { type: 'Number', value: '1' };
     if (valid.length === 1) return valid[0];
     return { type: 'Operator', operator: '*', args: valid };
  }

  private handleSinCos(
    m: number, n: number, variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[], depth: number
  ): { result: CanonicalAST, trigSteps: TrigIdentityStep[] } | null {
     const trigSteps: TrigIdentityStep[] = [];
     
     // Original expression
     const originalAST = this.multiplyASTs([
        m > 0 ? this.createTrigNode('sin', m, variable) : { type: 'Number', value: '1' },
        n > 0 ? this.createTrigNode('cos', n, variable) : { type: 'Number', value: '1' }
     ]);

     let transformedAST: CanonicalAST;
     let identityStr = '';

     if (m % 2 === 1) {
        // Odd sin: sin^(m)(x) cos^n(x) = sin(x) (1-cos^2(x))^((m-1)/2) cos^n(x)
        const k = (m - 1) / 2;
        const cosBase = this.createTrigNode('cos', 1, variable);
        const cosSq = { type: 'Operator', operator: '^', args: [cosBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const oneMinusCosSq = { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '1' }, cosSq] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? oneMinusCosSq : { type: 'Operator', operator: '^', args: [oneMinusCosSq, { type: 'Number', value: k.toString() }] } as CanonicalAST);
        
        transformedAST = this.multiplyASTs([
           this.createTrigNode('sin', 1, variable),
           sub,
           n > 0 ? this.createTrigNode('cos', n, variable) : { type: 'Number', value: '1' }
        ]);
        identityStr = 'sin²(x) = 1 - cos²(x)';
     } else if (n % 2 === 1) {
        // Odd cos
        const k = (n - 1) / 2;
        const sinBase = this.createTrigNode('sin', 1, variable);
        const sinSq = { type: 'Operator', operator: '^', args: [sinBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const oneMinusSinSq = { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '1' }, sinSq] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? oneMinusSinSq : { type: 'Operator', operator: '^', args: [oneMinusSinSq, { type: 'Number', value: k.toString() }] } as CanonicalAST);

        transformedAST = this.multiplyASTs([
           m > 0 ? this.createTrigNode('sin', m, variable) : { type: 'Number', value: '1' },
           sub,
           this.createTrigNode('cos', 1, variable)
        ]);
        identityStr = 'cos²(x) = 1 - sin²(x)';
     } else if (m > 0 || n > 0) {
        // Both even (and at least one is > 0)
        // sin^2(x) = (1 - cos(2x))/2, cos^2(x) = (1 + cos(2x))/2
        if (m + n > 4) return null; // Resource limit for expanding double angles

        let current = originalAST;
        let finalTransformed = originalAST; // To be built

        // A full robust implementation would replace sin^2 with (1-cos(2x))/2
        // Since double angles introduce 2x, it becomes a Substitution problem!
        const twoX: CanonicalAST = { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '2' }, { type: 'Symbol', name: variable }] };
        const cos2x = { type: 'Function', name: 'cos', args: [twoX] } as CanonicalAST;
        const half = { type: 'Operator', operator: '/', args: [{ type: 'Number', value: '1' }, { type: 'Number', value: '2' }] } as CanonicalAST;
        
        const sin2sub = { type: 'Operator', operator: '*', args: [
           half,
           { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '1' }, cos2x] }
        ] } as CanonicalAST;
        
        const cos2sub = { type: 'Operator', operator: '*', args: [
           half,
           { type: 'Operator', operator: '+', args: [{ type: 'Number', value: '1' }, cos2x] }
        ] } as CanonicalAST;

        let parts: CanonicalAST[] = [];
        for (let i = 0; i < m / 2; i++) parts.push(sin2sub);
        for (let i = 0; i < n / 2; i++) parts.push(cos2sub);

        transformedAST = this.multiplyASTs(parts);
        identityStr = 'sin²(x)=(1-cos(2x))/2, cos²(x)=(1+cos(2x))/2';
     } else {
        return null;
     }

     return this.finalizeTransform(originalAST, transformedAST, identityStr, variable, integrateFn, steps, depth, trigSteps);
  }

  private handleTanSec(
    m: number, n: number, variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[], depth: number
  ): { result: CanonicalAST, trigSteps: TrigIdentityStep[] } | null {
     const trigSteps: TrigIdentityStep[] = [];
     const originalAST = this.multiplyASTs([
        m > 0 ? this.createTrigNode('tan', m, variable) : { type: 'Number', value: '1' },
        n > 0 ? this.createTrigNode('sec', n, variable) : { type: 'Number', value: '1' }
     ]);

     let transformedAST: CanonicalAST;
     let identityStr = '';

     if (m === 2 && n === 0) {
        // tan²(x) = sec²(x) - 1
        //
        // This reduces directly to two Phase 6A integrals:
        // ∫sec²(x)dx - ∫1dx = tan(x) - x.
        transformedAST = {
           type: 'Operator',
           operator: '-',
           args: [
              this.createTrigNode(
                 'sec',
                 2,
                 variable
              ),
              {
                 type: 'Number',
                 value: '1'
              }
           ]
        };

        identityStr = 'tan²(x) = sec²(x) - 1';
     } else if (n >= 2 && n % 2 === 0) {
        // Even sec: sec^2(x) dx is du for u=tan(x)
        // sec^n(x) = (1+tan^2(x))^((n-2)/2) sec^2(x)
        const k = (n - 2) / 2;
        const tanBase = this.createTrigNode('tan', 1, variable);
        const tanSq = { type: 'Operator', operator: '^', args: [tanBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const onePlusTanSq = { type: 'Operator', operator: '+', args: [{ type: 'Number', value: '1' }, tanSq] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? onePlusTanSq : { type: 'Operator', operator: '^', args: [onePlusTanSq, { type: 'Number', value: k.toString() }] } as CanonicalAST);

        transformedAST = this.multiplyASTs([
           m > 0 ? this.createTrigNode('tan', m, variable) : { type: 'Number', value: '1' },
           sub,
           this.createTrigNode('sec', 2, variable)
        ]);
        identityStr = 'sec²(x) = 1 + tan²(x)';
     } else if (m >= 1 && m % 2 === 1) {
        // Odd tan: sec(x)tan(x) dx is du for u=sec(x)
        if (n === 0 && m === 1) {
           // just tan(x), delegate to sin(x)/cos(x) so 6B can handle it
           transformedAST = { type: 'Operator', operator: '/', args: [
              this.createTrigNode('sin', 1, variable),
              this.createTrigNode('cos', 1, variable)
           ] };
           identityStr = 'tan(x) = sin(x)/cos(x)';
           return this.finalizeTransform(originalAST, transformedAST, identityStr, variable, integrateFn, steps, depth, trigSteps);
        }
        
        // tan^m(x) = (sec^2(x)-1)^((m-1)/2) tan(x)
        const k = (m - 1) / 2;
        const secBase = this.createTrigNode('sec', 1, variable);
        const secSq = { type: 'Operator', operator: '^', args: [secBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const secSqMinusOne = { type: 'Operator', operator: '-', args: [secSq, { type: 'Number', value: '1' }] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? secSqMinusOne : { type: 'Operator', operator: '^', args: [secSqMinusOne, { type: 'Number', value: k.toString() }] } as CanonicalAST);

        transformedAST = this.multiplyASTs([
           sub,
           n - 1 > 0 ? this.createTrigNode('sec', n - 1, variable) : { type: 'Number', value: '1' },
           this.createTrigNode('sec', 1, variable), // isolate sec(x)tan(x)
           this.createTrigNode('tan', 1, variable)
        ]);
        identityStr = 'tan²(x) = sec²(x) - 1';
     } else {
        return null;
     }

     return this.finalizeTransform(originalAST, transformedAST, identityStr, variable, integrateFn, steps, depth, trigSteps);
  }

  private handleCotCsc(
    m: number, n: number, variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[], depth: number
  ): { result: CanonicalAST, trigSteps: TrigIdentityStep[] } | null {
     const trigSteps: TrigIdentityStep[] = [];
     const originalAST = this.multiplyASTs([
        m > 0 ? this.createTrigNode('cot', m, variable) : { type: 'Number', value: '1' },
        n > 0 ? this.createTrigNode('csc', n, variable) : { type: 'Number', value: '1' }
     ]);

     let transformedAST: CanonicalAST;
     let identityStr = '';

     if (n >= 2 && n % 2 === 0) {
        const k = (n - 2) / 2;
        const cotBase = this.createTrigNode('cot', 1, variable);
        const cotSq = { type: 'Operator', operator: '^', args: [cotBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const onePlusCotSq = { type: 'Operator', operator: '+', args: [{ type: 'Number', value: '1' }, cotSq] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? onePlusCotSq : { type: 'Operator', operator: '^', args: [onePlusCotSq, { type: 'Number', value: k.toString() }] } as CanonicalAST);

        transformedAST = this.multiplyASTs([
           m > 0 ? this.createTrigNode('cot', m, variable) : { type: 'Number', value: '1' },
           sub,
           this.createTrigNode('csc', 2, variable)
        ]);
        identityStr = 'csc²(x) = 1 + cot²(x)';
     } else if (m >= 1 && m % 2 === 1) {
        if (n === 0 && m === 1) {
           transformedAST = { type: 'Operator', operator: '/', args: [
              this.createTrigNode('cos', 1, variable),
              this.createTrigNode('sin', 1, variable)
           ] };
           identityStr = 'cot(x) = cos(x)/sin(x)';
           return this.finalizeTransform(originalAST, transformedAST, identityStr, variable, integrateFn, steps, depth, trigSteps);
        }
        
        const k = (m - 1) / 2;
        const cscBase = this.createTrigNode('csc', 1, variable);
        const cscSq = { type: 'Operator', operator: '^', args: [cscBase, { type: 'Number', value: '2' }] } as CanonicalAST;
        const cscSqMinusOne = { type: 'Operator', operator: '-', args: [cscSq, { type: 'Number', value: '1' }] } as CanonicalAST;
      const sub: CanonicalAST = k === 0 ? { type: 'Number', value: '1' } : (k === 1 ? cscSqMinusOne : { type: 'Operator', operator: '^', args: [cscSqMinusOne, { type: 'Number', value: k.toString() }] } as CanonicalAST);

        transformedAST = this.multiplyASTs([
           sub,
           n - 1 > 0 ? this.createTrigNode('csc', n - 1, variable) : { type: 'Number', value: '1' },
           this.createTrigNode('csc', 1, variable),
           this.createTrigNode('cot', 1, variable)
        ]);
        identityStr = 'cot²(x) = csc²(x) - 1';
     } else {
        return null;
     }

     return this.finalizeTransform(originalAST, transformedAST, identityStr, variable, integrateFn, steps, depth, trigSteps);
  }

  private finalizeTransform(
    originalAST: CanonicalAST,
    transformedAST: CanonicalAST,
    identityStr: string,
    variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[],
    depth: number,
    trigSteps: TrigIdentityStep[]
  ): { result: CanonicalAST, trigSteps: TrigIdentityStep[] } | null {
     let vStatus: VerificationStatus = 'not_proven';
     
     // 1. Try structural verification
     const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [originalAST, transformedAST] });
     if (diff.type === 'Number' && diff.value === '0') {
        vStatus = 'exactly_equivalent';
     } else {
        // 2. Try numerical consistency
        const isEq = this.verifyEquivalenceNum(originalAST, transformedAST, variable);
        if (!isEq) return null; // Inconsistent, transformation is wrong
        vStatus = 'numerically_consistent';
     }

     trigSteps.push({
        identity: identityStr,
        originalExpression: originalAST,
        transformedExpression: transformedAST,
        verificationStatus: vStatus
     });

     steps.push({
        id: `trig_${Date.now()}`,
        title: 'Trigonometric Identity',
        explanation: `Applied ${identityStr}: ${ASTUtils.serialize(originalAST)} ≡ ${ASTUtils.serialize(transformedAST)}`
     });

     try {
        const integrated = integrateFn(transformedAST, variable, steps, depth + 1);
        return { result: integrated, trigSteps };
     } catch {
        return null;
     }
  }

  private verifyEquivalenceNum(a: CanonicalAST, b: CanonicalAST, variable: string): boolean {
     for (const testVal of [0.1, 0.5, 0.9, 1.2]) {
        const v1 = this.evalASTNum(a, variable, testVal);
        const v2 = this.evalASTNum(b, variable, testVal);
        if (v1 === null || v2 === null) continue;
        if (Math.abs(v1 - v2) > 1e-7) return false;
     }
     return true;
  }

  private evalASTNum(node: CanonicalAST, variable: string, x: number): number | null {
     if (node.type === 'Number') return parseFloat(node.value);
     if (node.type === 'Symbol') return node.name === variable ? x : null;
     if (node.type === 'Function') {
        const inner = this.evalASTNum(node.args[0], variable, x);
        if (inner === null) return null;
        if (node.name === 'sin') return Math.sin(inner);
        if (node.name === 'cos') return Math.cos(inner);
        if (node.name === 'tan') return Math.tan(inner);
        if (node.name === 'sec') return 1 / Math.cos(inner);
        if (node.name === 'csc') return 1 / Math.sin(inner);
        if (node.name === 'cot') return 1 / Math.tan(inner);
     }
     if (node.type === 'Operator') {
        const args = node.args.map(a => this.evalASTNum(a, variable, x));
        if (args.some(a => a === null)) return null;
        if (node.operator === '+') return args.reduce((a, b) => a! + b!, 0);
        if (node.operator === '-') return args.length === 1 ? -args[0]! : args.reduce((a, b) => a! - b!);
        if (node.operator === '*') return args.reduce((a, b) => a! * b!, 1);
        if (node.operator === '/') return args[0]! / args[1]!;
        if (node.operator === '^') return Math.pow(args[0]!, args[1]!);
     }
     return null;
  }
}
