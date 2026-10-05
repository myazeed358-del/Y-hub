import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { EquationSolution } from '../types/result';
import { SymbolicSimplifier } from './simplifier';
import { DomainAnalyzer } from '../domain';
import { PolynomialExtractor } from './polynomial';
import { MathVerifier } from '../verification';
import { ASTEvaluator } from './evaluator';
import { NumericSolver } from '../numeric';
import { ASTUtils } from './utils';
import { PolynomialExpander } from './expander';

export interface SolverOptions {
  domain: 'real' | 'complex';
  mode: 'EXACT' | 'NUMERIC' | 'AUTO';
}

type EquationCandidate = {
  value: CanonicalAST;
  multiplicity: number;
};

export class EquationSolver {
  private simplifier = new SymbolicSimplifier();
  private domainAnalyzer = new DomainAnalyzer();
  private polyExtractor = new PolynomialExtractor();
  private verifier = new MathVerifier();
  private evaluator = new ASTEvaluator();
  private numericSolver = new NumericSolver();
  private expander = new PolynomialExpander();

  public solve(
    originalEq: CanonicalAST, 
    variable: string, 
    options: SolverOptions = { domain: 'real', mode: 'AUTO' }, 
    steps: MathStep[] = []
  ): { 
    finalSolutions: EquationSolution[], 
    rejectedSolutions: EquationSolution[], 
    completeness: 'all_roots_found' | 'partial_numerical_roots_found' | 'root_search_incomplete' | 'unsupported' 
  } {
    if (originalEq.type !== 'Equation') throw new Error('Input must be an Equation node.');

    const originalLHS = (originalEq as any).lhs;
    const originalRHS = (originalEq as any).rhs;

    const denominatorASTs = this.extractAllDenominators(originalEq);

    let completeness: any = 'all_roots_found';
    let candidates: EquationCandidate[] = [];
    
    try {
      candidates = this.generateCandidates(originalEq, variable, options, steps);
    } catch (e: any) {
      if (e.message.includes('ROUTE_TO_PYTHON')) throw e;
      if (e.message === 'INFINITE_SOLUTIONS') throw e;
      completeness = 'unsupported';
    }

    const finalSolutions: EquationSolution[] = [];
    const rejectedSolutions: EquationSolution[] = [];
    
    for (const candidate of candidates) {
      const candAST = candidate.value;
      let candVal: number | null = null;
      if (candAST.type === 'Number') candVal = parseFloat((candAST as any).value);
      
      let extraneous = false;
      let conditions: string[] = [];
      
      if (candVal !== null) {
        for (const den of denominatorASTs) {
          try {
            const val = this.evaluator.evaluate(den, { [variable]: candVal });
            if (Math.abs(val) < 1e-7) {
              extraneous = true;
              conditions.push(`Excluded by denominator restriction (${variable} ≠ ${candVal})`);
            }
          } catch(e) {}
        }
      }

      const vResult = this.verifier.verifyEquationRoot(originalLHS, originalRHS, variable, candAST);
      
      if (vResult.status === 'not_equivalent') {
        extraneous = true;
        conditions.push('Invalidated by substitution into original equation (often an extraneous root from squaring).');
      }
      
      const sol: EquationSolution = {
        value: candAST,
        exact: true,
        conditions,
        verification: vResult.status,
        extraneous,
        multiplicity: candidate.multiplicity
      };
      
      if (extraneous) {
        rejectedSolutions.push(sol);
      } else {
        const existing = finalSolutions.find(
          existingSolution =>
            ASTUtils.structuralEquals(existingSolution.value, sol.value)
        );

        if (existing) {
          existing.multiplicity = Math.max(
            existing.multiplicity ?? 1,
            sol.multiplicity ?? 1
          );
        } else {
          finalSolutions.push(sol);
        }
      }
    }

    return { finalSolutions, rejectedSolutions, completeness };
  }

  private generateCandidates(
    eq: CanonicalAST,
    variable: string,
    options: SolverOptions,
    steps: MathStep[],
    transformationDepth = 0
  ): EquationCandidate[] {
    if (transformationDepth > 12) {
      throw new Error('EQUATION_TRANSFORMATION_LIMIT');
    }
    const absNode = ASTUtils.findNode(eq, n => n.type === 'Function' && (n as any).name === 'abs');
    if (absNode) {
      steps.push({ id: `abs_branching_${Date.now()}`, title: 'Absolute Value Branching', explanation: 'Split equation into two branches for absolute value.' });
      const inner = (absNode as any).args[0];
      const posEq = ASTUtils.replaceNode(eq, absNode, inner);
      const negEq = ASTUtils.replaceNode(eq, absNode, { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, inner] });
      return [
        ...this.generateCandidates(posEq, variable, options, steps, transformationDepth + 1),
        ...this.generateCandidates(negEq, variable, options, steps, transformationDepth + 1)
      ];
    }

    let normalized: CanonicalAST = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [(eq as any).lhs, (eq as any).rhs] });

    /*
     * Exponential functions are never zero:
     *
     *     exp(g(x)) != 0
     *
     * for every finite real or complex g(x). Therefore an equation
     * whose normalized form is exactly exp(g(x)) = 0 has no roots.
     */
    if (
      normalized.type === 'Function' &&
      normalized.name.toLowerCase() === 'exp'
    ) {
      return [];
    }


      /*
       * Zero of a rational expression:
       *
       *     N(x) / D(x) = 0  <=>  N(x) = 0, with D(x) != 0.
       *
       * Reduce to the numerator before radical isolation. This prevents
       * reciprocal radicals such as 1/(2*sqrt(x-1)) from entering the
       * radical-squaring route even though they can never equal zero.
       *
       * solve() verifies candidates against the original equation and
       * its denominator restrictions, so excluded denominator roots
       * remain protected.
       */
      if (
        normalized.type === 'Operator' &&
        normalized.operator === '/' &&
        normalized.args.length === 2 &&
        this.extractAllDenominators(normalized.args[1]).length === 0
      ) {
        const numerator = this.simplifier.simplify(normalized.args[0]);

        if (numerator.type === 'Number') {
          const numeratorValue = Number(numerator.value);

          if (Number.isFinite(numeratorValue)) {
            if (numeratorValue === 0) {
              throw new Error('INFINITE_SOLUTIONS');
            }

            return [];
          }
        }

        const numeratorEquation: CanonicalAST = {
          type: 'Equation',
          lhs: numerator,
          rhs: { type: 'Number', value: '0' }
        };

        return this.generateCandidates(
          numeratorEquation,
          variable,
          options,
          steps,
          transformationDepth + 1
        );
      }


      /*
       * Clear denominators before radical isolation.
       *
       * Radicals may occur inside nested reciprocals. Solving the zero
       * equation after denominators are cleared prevents reciprocal
       * radicals from being repeatedly squared without making progress.
       *
       * Candidate verification in solve() is still performed against the
       * original equation, so denominator exclusions remain enforced.
       */
      const denominatorASTs = this.extractAllDenominators(eq);

      let clearedEq: CanonicalAST = normalized;
      if (denominatorASTs.length > 0) {
        clearedEq = {
          type: 'Operator',
          operator: '*',
          args: [normalized, ...denominatorASTs]
        };
      }

      const simplified = this.simplifier.simplify(clearedEq);

      /*
       * Safety/progress invariant:
       * Radical isolation must never run while a square root is still
       * nested inside a denominator. In that shape, squaring does not
       * eliminate the radical reliably and can cause exponential AST
       * growth through recursive expansion.
       *
       * Returning "unsupported" is preferable to hanging the symbolic
       * engine. The caller can still use domain/qualitative analysis.
       */
      const remainingDenominators = this.extractAllDenominators(simplified);

      const hasRadicalDenominator = remainingDenominators.some(
        denominator =>
          ASTUtils.findNode(
            denominator,
            node =>
              node.type === 'Function' &&
              node.name.toLowerCase() === 'sqrt'
          ) !== null
      );

      if (hasRadicalDenominator) {
        throw new Error('UNSUPPORTED_RADICAL_DENOMINATOR');
      }

      const sqrtNode = ASTUtils.findNode(
        simplified,
        n => n.type === 'Function' && (n as any).name === 'sqrt'
      );

      if (sqrtNode) {
        steps.push({
          id: `sqrt_isolation_${Date.now()}`,
          title: 'Radical Isolation',
          explanation: 'Clear denominators, isolate the radical term, and square both sides.'
        });

        const terms = this.getSumTerms(simplified);

        const sqrtTerms = terms.filter(
          t =>
            ASTUtils.findNode(
              t,
              n => ASTUtils.structuralEquals(n, sqrtNode)
            ) !== null
        );

        const otherTerms = terms.filter(
          t =>
            ASTUtils.findNode(
              t,
              n => ASTUtils.structuralEquals(n, sqrtNode)
            ) === null
        );

        if (sqrtTerms.length === 0) return [];

        const lhs = this.sumNodes(sqrtTerms);

        const rhs = this.simplifier.simplify({
          type: 'Operator',
          operator: '*',
          args: [
            { type: 'Number', value: '-1' },
            this.sumNodes(otherTerms)
          ]
        });

        const lhsSquared = this.simplifier.simplify(
          this.expander.expand({
            type: 'Operator',
            operator: '^',
            args: [lhs, { type: 'Number', value: '2' }]
          })
        );

        const rhsSquared = this.simplifier.simplify(
          this.expander.expand({
            type: 'Operator',
            operator: '^',
            args: [rhs, { type: 'Number', value: '2' }]
          })
        );

        const newEq: CanonicalAST = {
          type: 'Equation',
          lhs: lhsSquared,
          rhs: rhsSquared
        };

        return this.generateCandidates(
          newEq,
          variable,
          options,
          steps,
          transformationDepth + 1
        );
      }

    const coeffsMap = this.polyExtractor.extract(simplified, variable);
    const degrees = Array.from(coeffsMap.keys()).sort((a, b) => b - a);
    const maxDegree = degrees.length > 0 ? degrees[0] : 0;
    
    const coeffsNum: number[] = new Array(maxDegree + 1).fill(0);
    let isNumericPoly = true;
    for (let i = 0; i <= maxDegree; i++) {
      const cAST = this.sumCoeffs(coeffsMap.get(i) || []);
      const sAST = this.simplifier.simplify(cAST);
      if (sAST.type === 'Number') {
        coeffsNum[i] = parseFloat((sAST as any).value);
      } else {
        isNumericPoly = false;
      }
    }

    if (maxDegree === 0) {
      if (isNumericPoly && Math.abs(coeffsNum[0]) < 1e-9) throw new Error('INFINITE_SOLUTIONS');
      return [];
    } 
    
    if (isNumericPoly) {
      const { roots, remainingCoeffs } = this.polyExtractor.findRationalRoots(coeffsNum);
      const rawCandidates: EquationCandidate[] = roots.map(root => ({
        value: {
          type: 'Number',
          value: root.value.toString()
        },
        multiplicity: root.multiplicity
      }));
      
      const remDegree = remainingCoeffs.length - 1;
      
      if (remDegree === 2) {
        rawCandidates.push(
          ...this.solveQuadraticNumeric(
            remainingCoeffs[2],
            remainingCoeffs[1],
            remainingCoeffs[0],
            options
          )
        );
      } else if (remDegree === 1) {
        const a = remainingCoeffs[1], b = remainingCoeffs[0];
        if (a !== 0) {
          rawCandidates.push({
            value: {
              type: 'Number',
              value: (-b / a).toString()
            },
            multiplicity: 1
          });
        }
      } else if (remDegree > 2) {
        if (options.mode === 'EXACT') throw new Error('ROUTE_TO_PYTHON_EXACT');
        for (const pt of [-10, -5, 0, 5, 10]) {
          const numRoot = this.numericSolver.solveNewton(simplified, variable, pt);
          if (numRoot) {
            rawCandidates.push({
              value: {
                type: 'Number',
                value: numRoot.root.toString()
              },
              multiplicity: 1
            });
          }
        }
      }
      return rawCandidates;
    }

    throw new Error('UNSUPPORTED_DEGREE_ROUTE_TO_PYTHON');
  }

  private getSumTerms(node: CanonicalAST): CanonicalAST[] {
    if (node.type === 'Operator' && node.operator === '+') {
      let terms: CanonicalAST[] = [];
      for (const arg of node.args) {
        terms = terms.concat(this.getSumTerms(arg));
      }
      return terms;
    }
    if (node.type === 'Operator' && node.operator === '-') {
      if (node.args.length === 1) {
        return [ { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, node.args[0]] } ];
      }
      let terms = this.getSumTerms(node.args[0]);
      for (let i = 1; i < node.args.length; i++) {
        const neg: CanonicalAST = { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, node.args[i]] };
        terms = terms.concat(this.getSumTerms(neg));
      }
      return terms;
    }
    return [node];
  }

  private sumNodes(nodes: CanonicalAST[]): CanonicalAST {
    if (nodes.length === 0) return { type: 'Number', value: '0' };
    if (nodes.length === 1) return nodes[0];
    return { type: 'Operator', operator: '+', args: nodes };
  }

  private extractAllDenominators(node: CanonicalAST): CanonicalAST[] {
    const dens: CanonicalAST[] = [];
    if (node.type === 'Operator') {
      if (node.operator === '/') dens.push(node.args[1]);
      node.args.forEach(a => dens.push(...this.extractAllDenominators(a)));
    } else if (node.type === 'Function') {
      node.args.forEach(a => dens.push(...this.extractAllDenominators(a)));
    } else if (node.type === 'Parenthesis') {
      dens.push(...this.extractAllDenominators(node.content));
    } else if (node.type === 'Equation' || node.type === 'Inequality') {
      dens.push(...this.extractAllDenominators((node as any).lhs));
      dens.push(...this.extractAllDenominators((node as any).rhs));
    }
    return dens;
  }

  private solveQuadraticNumeric(
    a: number,
    b: number,
    c: number,
    options: SolverOptions
  ): EquationCandidate[] {
    const candidates: EquationCandidate[] = [];
    if (a === 0) {
      if (b !== 0) {
        candidates.push({
          value: {
            type: 'Number',
            value: (-c / b).toString()
          },
          multiplicity: 1
        });
      }
      return candidates;
    }
    const discriminant = b*b - 4*a*c;
    if (discriminant < 0) {
      if (options.domain === 'complex') {
        const negB = { type: 'Number', value: (-b).toString() } as CanonicalAST;
        const twoA = { type: 'Number', value: (2*a).toString() } as CanonicalAST;
        const iNode = { type: 'Constant', name: 'i' } as CanonicalAST;
        const sqrtD = { type: 'Operator', operator: '*', args: [{ type: 'Number', value: Math.sqrt(-discriminant).toString() }, iNode] } as CanonicalAST;
        candidates.push({
          value: this.simplifier.simplify({
            type: 'Operator',
            operator: '/',
            args: [
              {
                type: 'Operator',
                operator: '+',
                args: [negB, sqrtD]
              },
              twoA
            ]
          }),
          multiplicity: 1
        });

        candidates.push({
          value: this.simplifier.simplify({
            type: 'Operator',
            operator: '/',
            args: [
              {
                type: 'Operator',
                operator: '-',
                args: [negB, sqrtD]
              },
              twoA
            ]
          }),
          multiplicity: 1
        });
      }
    } else if (discriminant === 0) {
      candidates.push({
        value: {
          type: 'Number',
          value: (-b / (2 * a)).toString()
        },
        multiplicity: 2
      });
    } else {
      candidates.push({
        value: {
          type: 'Number',
          value: (
            (-b + Math.sqrt(discriminant)) /
            (2 * a)
          ).toString()
        },
        multiplicity: 1
      });

      candidates.push({
        value: {
          type: 'Number',
          value: (
            (-b - Math.sqrt(discriminant)) /
            (2 * a)
          ).toString()
        },
        multiplicity: 1
      });
    }
    return candidates;
  }

  private sumCoeffs(coeffs: CanonicalAST[]): CanonicalAST {
    if (coeffs.length === 0) return { type: 'Number', value: '0' };
    if (coeffs.length === 1) return coeffs[0];
    return { type: 'Operator', operator: '+', args: coeffs };
  }
}
