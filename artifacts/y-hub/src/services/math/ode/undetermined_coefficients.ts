import { CanonicalAST } from '../types/ast';
import { ODERequest, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';
import { Rat, Rational } from '../utils/rational';

import { PolynomialExtractor } from '../symbolic/polynomial';
import { UndeterminedCoefficientsCodec } from './undeterminedCoefficientsCodec';
import { ForcingTrialBuilder } from './forcingTrialBuilder';
import { CoefficientSystemSolver } from './coefficientSystemSolver';

export class UndeterminedCoefficientsEngine {
 private readonly codec = new UndeterminedCoefficientsCodec();
 private readonly trials = new ForcingTrialBuilder();
 private readonly coefficientSolver = new CoefficientSystemSolver();
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();

    private polyExtractor = new PolynomialExtractor();

    public solveParticular(
        req: ODERequest,
        g: CanonicalAST,
        x: string,
        coeffs: CanonicalAST[]
    ): { yp: CanonicalAST, steps: ODEStep[] } | null {
        const forcing = this.trials.analyzeForcing(g, x);
        if (!forcing) return null;

        // PolynomialExtractor expects characteristic coefficients
        // in ascending order: [a0, a1, ..., an].
        const charCoeffs: Rational[] = [];

        for (let i = 0; i < coeffs.length; i++) {
            const r = this.codec.parseRat(coeffs[i]);
            if (!r) return null;

            charCoeffs.push(r);
        }

        const charRoots =
            this.polyExtractor.findRationalRootsExact(charCoeffs);

        let resonanceMultiplicity = 0;

        if (
            forcing.kind === 'polynomial' ||
            forcing.kind === 'exp_polynomial'
        ) {
            const root =
                forcing.kind === 'polynomial'
                    ? Rat.zero
                    : forcing.a!;

            const match = charRoots.roots.find(r =>
                Rat.equals(r.value, root)
            );

            resonanceMultiplicity =
                match?.multiplicity ?? 0;
        } else {
            resonanceMultiplicity =
                this.trials.complexResonanceMultiplicity(
                    coeffs,
                    forcing.b!
                );
        }

        const { trial, constants } =
            this.trials.buildTrialForForcing(
                forcing,
                resonanceMultiplicity,
                x
            );

        // E(x) = L[y_p] - g(x)
        let Lyp: CanonicalAST = {
            type: 'Number',
            value: '0'
        };

        let currentDerivative = trial;

        for (let i = 0; i < coeffs.length; i++) {
            const term: CanonicalAST = {
                type: 'Operator',
                operator: '*',
                args: [coeffs[i], currentDerivative]
            };

            Lyp =
                i === 0
                    ? term
                    : {
                        type: 'Operator',
                        operator: '+',
                        args: [Lyp, term]
                    };

            if (i < coeffs.length - 1) {
                currentDerivative =
                    this.simplifier.simplify(
                        this.dEngine.differentiate(
                            currentDerivative,
                            x
                        )
                    );
            }
        }

        let E = this.simplifier.simplify({
            type: 'Operator',
            operator: '-',
            args: [Lyp, g]
        });

        // Generate as many independent equations as unknowns
        // using E^(k)(0)=0.
        const equations: CanonicalAST[] = [];

        for (let i = 0; i < constants.length; i++) {
            equations.push(
                this.simplifier.simplify(
                    ASTUtils.replaceNode(
                        E,
                        { type: 'Symbol', name: x },
                        { type: 'Number', value: '0' }
                    )
                )
            );

            if (i < constants.length - 1) {
                E = this.simplifier.simplify(
                    this.dEngine.differentiate(E, x)
                );
            }
        }

        const matrix: Rational[][] = [];
        const rhs: Rational[] = [];

        for (const equation of equations) {
            const row: Rational[] = [];

            for (const constant of constants) {
                const coefficient =
                    this.simplifier.simplify(
                        this.dEngine.differentiate(
                            equation,
                            constant
                        )
                    );

                const parsed = this.codec.parseRat(coefficient);
                if (!parsed) return null;

                row.push(parsed);
            }

            let constantPart = equation;

            for (const constant of constants) {
                constantPart = ASTUtils.replaceNode(
                    constantPart,
                    {
                        type: 'Symbol',
                        name: constant
                    },
                    {
                        type: 'Number',
                        value: '0'
                    }
                );
            }

            const parsedConstant =
                this.codec.parseRat(
                    this.simplifier.simplify(
                        constantPart
                    )
                );

            if (!parsedConstant) return null;

            matrix.push(row);
            rhs.push({
                num: -parsedConstant.num,
                den: parsedConstant.den
            });
        }

        const solved =
            this.coefficientSolver.solveLinearSystem(matrix, rhs);

        if (!solved) return null;

        let yp = trial;

        for (let i = 0; i < constants.length; i++) {
            yp = ASTUtils.replaceNode(
                yp,
                {
                    type: 'Symbol',
                    name: constants[i]
                },
                this.codec.ratToAST(solved[i])
            );
        }

        yp = this.simplifier.simplify(yp);

        return {
            yp,
            steps: [{
                strategy: 'Undetermined Coefficients',
                inputExpression: g,
                transformation:
                    `Generated a forcing-family trial and solved ` +
                    `its exact coefficient system; resonance ` +
                    `multiplier x^${resonanceMultiplicity} applied.`,
                resultingExpression: yp
            }]
        };
    }


}

