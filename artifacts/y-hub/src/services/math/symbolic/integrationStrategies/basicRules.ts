import type { CanonicalAST } from '../../types/ast';
import type { MathStep } from '../../types/step';
import { ASTUtils } from '../utils';
import { SymbolicSimplifier } from '../simplifier';
import { DerivativeEngine } from '../derivative';
import { Rat } from '../../utils/rational';

/** Independent BasicIntegrationRules integration strategy rules. */
export class BasicIntegrationRules {
  private readonly simplifier = new SymbolicSimplifier();
  private readonly derivativeEngine = new DerivativeEngine();

public matchBasicPattern(node: CanonicalAST, variable: string, steps: MathStep[]): CanonicalAST | null {
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

    // ∫ c/x dx = c ln|x|
    //
    // Important for u-substitution where the transformed integrand
    // may be -1/u, 1/2u, etc.
    if (
       node.type === 'Operator' &&
       node.operator === '/' &&
       node.args[0].type === 'Number' &&
       node.args[1].type === 'Symbol' &&
       node.args[1].name === variable
    ) {
       const coefficient = node.args[0];

       steps.push({
         id: `int_c_over_x_${Date.now()}`,
         title: 'Logarithm Rule',
         explanation: '∫ c/x dx = c ln|x|'
       });

       return this.simplifier.simplify({
         type: 'Operator',
         operator: '*',
         args: [
           coefficient,
           {
             type: 'Function',
             name: 'ln',
             args: [
               {
                 type: 'Function',
                 name: 'abs',
                 args: [node.args[1]]
               }
             ]
           }
         ]
       });
    }

    // ∫ c/(a*x+b) dx = (c/a) ln|a*x+b|
    if (
       node.type === 'Operator' &&
       node.operator === '/' &&
       node.args[0].type === 'Number'
    ) {
       const numerator = node.args[0];
       const denominator = node.args[1];

       try {
          const derivative = this.simplifier.simplify(
             this.derivativeEngine.differentiate(
                denominator,
                variable
             )
          );

          if (
             derivative.type === 'Number' &&
             derivative.value !== '0'
          ) {
             const coefficient = this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [numerator, derivative]
             });

             steps.push({
                id: `int_linear_den_${Date.now()}`,
                title: 'Linear Denominator Rule',
                explanation: '∫ c/(ax+b) dx = (c/a) ln|ax+b|'
             });

             return this.simplifier.simplify({
                type: 'Operator',
                operator: '*',
                args: [
                   coefficient,
                   {
                      type: 'Function',
                      name: 'ln',
                      args: [
                         {
                            type: 'Function',
                            name: 'abs',
                            args: [denominator]
                         }
                      ]
                   }
                ]
             });
          }
       } catch {
          // Not a supported linear denominator.
       }
    }

    // ∫ 1/x^n dx = ∫ x^(-n) dx
    //
    // This form commonly appears after u-substitution, e.g.
    // 2x/(x^2+1)^2 -> 1/u^2.
    if (
       node.type === 'Operator' &&
       node.operator === '/' &&
       node.args[0].type === 'Number' &&
       node.args[0].value === '1' &&
       node.args[1].type === 'Operator' &&
       node.args[1].operator === '^' &&
       node.args[1].args[0].type === 'Symbol' &&
       node.args[1].args[0].name === variable &&
       node.args[1].args[1].type === 'Number'
    ) {
       try {
          const exponent = Rat.fromString(
             node.args[1].args[1].value
          );

          const negativeExponent = Rat.mul(
             Rat.minusOne,
             exponent
          );

          const rewritten: CanonicalAST = {
             type: 'Operator',
             operator: '^',
             args: [
                node.args[1].args[0],
                {
                   type: 'Number',
                   value: Rat.toString(negativeExponent)
                }
             ]
          };

          return this.matchBasicPattern(
             rewritten,
             variable,
             steps
          );
       } catch {
          // Fall through to the remaining direct patterns.
       }
    }

    // ∫ 1/sqrt(x) dx = 2sqrt(x)
    //
    // Keep this structural rather than rewriting the exponent as a
    // Number such as "-1/2". Canonical Number nodes are decimal/integer
    // literals; exact fractions belong in AST operator form.
    if (
       node.type === 'Operator' &&
       node.operator === '/' &&
       node.args[0].type === 'Number' &&
       node.args[0].value === '1' &&
       node.args[1].type === 'Function' &&
       node.args[1].name === 'sqrt' &&
       node.args[1].args.length === 1 &&
       node.args[1].args[0].type === 'Symbol' &&
       node.args[1].args[0].name === variable
    ) {
       steps.push({
          id: `int_inv_sqrt_${Date.now()}`,
          title: 'Inverse Square Root Rule',
          explanation: '∫ 1/sqrt(x) dx = 2sqrt(x)'
       });

       return {
          type: 'Operator',
          operator: '*',
          args: [
             {
                type: 'Number',
                value: '2'
             },
             {
                type: 'Function',
                name: 'sqrt',
                args: [
                   {
                      type: 'Symbol',
                      name: variable
                   }
                ]
             }
          ]
       };
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
    if (node.type !== 'Operator' || node.operator !== '+') {
      return false;
    }

    const hasOne = node.args.some(
      a => a.type === 'Number' && a.value === '1'
    );

    const isXSquared = (a: CanonicalAST): boolean => {
      // x^2
      if (
        a.type === 'Operator' &&
        a.operator === '^' &&
        a.args.length === 2 &&
        a.args[0].type === 'Symbol' &&
        a.args[0].name === variable &&
        a.args[1].type === 'Number' &&
        a.args[1].value === '2'
      ) {
        return true;
      }

      // x*x
      if (
        a.type === 'Operator' &&
        (
          a.operator === '*' ||
          a.operator === 'implicit_multiply'
        ) &&
        a.args.length === 2 &&
        a.args[0].type === 'Symbol' &&
        a.args[1].type === 'Symbol' &&
        a.args[0].name === variable &&
        a.args[1].name === variable
      ) {
        return true;
      }

      return false;
    };

    return hasOne && node.args.some(isXSquared);
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
}
