import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { EquationSolution } from '../types/result';


import { MathVerifier } from '../verification';
import { ASTEvaluator } from './evaluator';

import { ASTUtils } from './utils';

import { EquationCandidateGenerator } from './EquationCandidateGenerator';

export interface SolverOptions {
  domain: 'real' | 'complex';
  mode: 'EXACT' | 'NUMERIC' | 'AUTO';
}

type EquationCandidate = {
  value: CanonicalAST;
  multiplicity: number;
};

export class EquationSolver {
  private generator = new EquationCandidateGenerator();


  private verifier = new MathVerifier();
  private evaluator = new ASTEvaluator();


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

    const denominatorASTs = this.generator.extractAllDenominators(originalEq);

    let completeness: any = 'all_roots_found';
    let candidates: EquationCandidate[] = [];

    try {
      candidates = this.generator.generateCandidates(originalEq, variable, options, steps);
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


}


/**
 * Backward-compatible adapter for legacy math services.
 *
 * EquationSolver is the canonical API.
 * Older ODE services still expect:
 *
 *   new EquationEngine().solveEquation(eq, variable)
 *
 * Keep this adapter until those consumers are migrated individually.
 */
export type LegacyEquationSolution = {
  status: 'exact' | 'approximate';
  value: CanonicalAST;
  conditions: string[];
  verification: EquationSolution['verification'];
};

export class EquationEngine {
  private solver = new EquationSolver();

  public solveEquation(
    equation: CanonicalAST,
    variable: string
  ): LegacyEquationSolution[] {
    try {
      const result = this.solver.solve(
        equation,
        variable,
        { domain: 'real', mode: 'AUTO' }
      );

      return result.finalSolutions
        .filter(solution => !solution.extraneous)
        .map(solution => ({
          status:
            solution.exact && !solution.approximation
              ? 'exact'
              : 'approximate',
          value: solution.value,
          conditions: solution.conditions,
          verification: solution.verification
        }));
    } catch (error: any) {
      const message = String(error?.message ?? error);

      // Legacy callers historically treated unsupported symbolic routes
      // as "no usable local solution", not as fatal engine failures.
      if (
        message === 'INFINITE_SOLUTIONS' ||
        message.includes('ROUTE_TO_PYTHON') ||
        message.includes('UNSUPPORTED')
      ) {
        return [];
      }

      throw error;
    }
  }
}
