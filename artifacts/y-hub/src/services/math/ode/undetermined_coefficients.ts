import { CanonicalAST } from '../types/ast';
import { ODERequest, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';
import { Rat, Rational } from '../utils/rational';
import { ODEUtils } from './utils';
import { PolynomialExtractor } from '../symbolic/polynomial';

export class UndeterminedCoefficientsEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private utils = new ODEUtils();
    private polyExtractor = new PolynomialExtractor();

    public solveParticular(
        req: ODERequest,
        g: CanonicalAST,
        x: string,
        coeffs: CanonicalAST[]
    ): { yp: CanonicalAST, steps: ODEStep[] } | null {
        const forcing = this.analyzeForcing(g, x);
        if (!forcing) return null;

        // PolynomialExtractor expects characteristic coefficients
        // in ascending order: [a0, a1, ..., an].
        const charCoeffs: Rational[] = [];

        for (let i = 0; i < coeffs.length; i++) {
            const r = this.parseRat(coeffs[i]);
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
                this.complexResonanceMultiplicity(
                    coeffs,
                    forcing.b!
                );
        }

        const { trial, constants } =
            this.buildTrialForForcing(
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

                const parsed = this.parseRat(coefficient);
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
                this.parseRat(
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
            this.solveLinearSystem(matrix, rhs);

        if (!solved) return null;

        let yp = trial;

        for (let i = 0; i < constants.length; i++) {
            yp = ASTUtils.replaceNode(
                yp,
                {
                    type: 'Symbol',
                    name: constants[i]
                },
                this.ratToAST(solved[i])
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

    private analyzeForcing(
        g: CanonicalAST,
        x: string
    ):
        | {
            kind: 'polynomial';
            degree: number;
        }
        | {
            kind: 'exp_polynomial';
            degree: number;
            a: Rational;
        }
        | {
            kind: 'trig_polynomial';
            degree: number;
            b: Rational;
        }
        | null {
        const directDegree =
            this.polynomialDegree(g, x);

        if (directDegree !== null) {
            return {
                kind: 'polynomial',
                degree: directDegree
            };
        }

        const factors =
            g.type === 'Operator' &&
            (
                g.operator === '*' ||
                g.operator === 'implicit_multiply'
            )
                ? g.args
                : [g];

        let exponential: Rational | null = null;
        let trig: Rational | null = null;
        let polynomialDegree = 0;

        for (const factor of factors) {
            if (
                factor.type === 'Function' &&
                factor.name === 'exp'
            ) {
                if (exponential !== null || trig !== null) {
                    return null;
                }

                exponential =
                    this.linearArgumentCoefficient(
                        factor.args[0],
                        x
                    );

                if (!exponential) return null;
                continue;
            }

            if (
                factor.type === 'Function' &&
                (
                    factor.name === 'sin' ||
                    factor.name === 'cos'
                )
            ) {
                if (trig !== null || exponential !== null) {
                    return null;
                }

                trig =
                    this.linearArgumentCoefficient(
                        factor.args[0],
                        x
                    );

                if (!trig) return null;
                continue;
            }

            const degree =
                this.polynomialDegree(factor, x);

            if (degree === null) return null;

            polynomialDegree += degree;
        }

        if (exponential) {
            return {
                kind: 'exp_polynomial',
                degree: polynomialDegree,
                a: exponential
            };
        }

        if (trig) {
            return {
                kind: 'trig_polynomial',
                degree: polynomialDegree,
                b: trig
            };
        }

        return null;
    }

    private polynomialDegree(
        node: CanonicalAST,
        x: string
    ): number | null {
        if (node.type === 'Number') return 0;

        if (
            node.type === 'Symbol' &&
            node.name === x
        ) {
            return 1;
        }

        if (
            node.type === 'Operator' &&
            node.operator === '^' &&
            node.args.length === 2 &&
            node.args[0].type === 'Symbol' &&
            node.args[0].name === x &&
            node.args[1].type === 'Number'
        ) {
            const power =
                Number(node.args[1].value);

            if (
                Number.isInteger(power) &&
                power >= 0
            ) {
                return power;
            }

            return null;
        }

        if (
            node.type === 'Operator' &&
            (
                node.operator === '+' ||
                node.operator === '-'
            )
        ) {
            const degrees =
                node.args.map(arg =>
                    this.polynomialDegree(arg, x)
                );

            if (
                degrees.some(
                    degree => degree === null
                )
            ) {
                return null;
            }

            return Math.max(
                ...degrees as number[]
            );
        }

        if (
            node.type === 'Operator' &&
            (
                node.operator === '*' ||
                node.operator ===
                    'implicit_multiply'
            )
        ) {
            let degree = 0;

            for (const arg of node.args) {
                const d =
                    this.polynomialDegree(arg, x);

                if (d === null) return null;

                degree += d;
            }

            return degree;
        }

        if (node.type === 'Parenthesis') {
            return this.polynomialDegree(
                node.content,
                x
            );
        }

        return null;
    }

    private linearArgumentCoefficient(
        node: CanonicalAST,
        x: string
    ): Rational | null {
        if (
            node.type === 'Symbol' &&
            node.name === x
        ) {
            return Rat.one;
        }

        if (
            node.type === 'Operator' &&
            (
                node.operator === '*' ||
                node.operator ===
                    'implicit_multiply'
            )
        ) {
            let coefficient = Rat.one;
            let foundX = false;

            for (const arg of node.args) {
                if (
                    arg.type === 'Symbol' &&
                    arg.name === x
                ) {
                    if (foundX) return null;
                    foundX = true;
                    continue;
                }

                const r = this.parseRat(arg);
                if (!r) return null;

                coefficient =
                    Rat.mul(coefficient, r);
            }

            return foundX
                ? Rat.simplify(coefficient)
                : null;
        }

        return null;
    }

    private buildTrialForForcing(
        forcing:
            | {
                kind: 'polynomial';
                degree: number;
            }
            | {
                kind: 'exp_polynomial';
                degree: number;
                a: Rational;
            }
            | {
                kind: 'trig_polynomial';
                degree: number;
                b: Rational;
            },
        resonanceMultiplicity: number,
        x: string
    ): {
        trial: CanonicalAST;
        constants: string[];
    } {
        const constants: string[] = [];
        let nextConstant = 1;

        const constant = (): CanonicalAST => {
            const name = `A${nextConstant++}`;
            constants.push(name);

            return {
                type: 'Symbol',
                name
            };
        };

        const xPower = (
            power: number
        ): CanonicalAST => {
            if (power === 0) {
                return {
                    type: 'Number',
                    value: '1'
                };
            }

            if (power === 1) {
                return {
                    type: 'Symbol',
                    name: x
                };
            }

            return {
                type: 'Operator',
                operator: '^',
                args: [
                    {
                        type: 'Symbol',
                        name: x
                    },
                    {
                        type: 'Number',
                        value: power.toString()
                    }
                ]
            };
        };

        const polynomial = (
            degree: number
        ): CanonicalAST => {
            let result: CanonicalAST | null =
                null;

            for (
                let power = 0;
                power <= degree;
                power++
            ) {
                const term =
                    this.simplifier.simplify({
                        type: 'Operator',
                        operator: '*',
                        args: [
                            constant(),
                            xPower(power)
                        ]
                    });

                result =
                    result === null
                        ? term
                        : {
                            type: 'Operator',
                            operator: '+',
                            args: [result, term]
                        };
            }

            return result!;
        };

        let baseTrial: CanonicalAST;

        if (forcing.kind === 'polynomial') {
            baseTrial =
                polynomial(forcing.degree);
        } else if (
            forcing.kind === 'exp_polynomial'
        ) {
            const expTerm: CanonicalAST = {
                type: 'Function',
                name: 'exp',
                args: [{
                    type: 'Operator',
                    operator: '*',
                    args: [
                        this.ratToAST(
                            forcing.a
                        ),
                        {
                            type: 'Symbol',
                            name: x
                        }
                    ]
                }]
            };

            baseTrial = {
                type: 'Operator',
                operator: '*',
                args: [
                    polynomial(forcing.degree),
                    expTerm
                ]
            };
        } else {
            const argument: CanonicalAST = {
                type: 'Operator',
                operator: '*',
                args: [
                    this.ratToAST(
                        forcing.b
                    ),
                    {
                        type: 'Symbol',
                        name: x
                    }
                ]
            };

            const cosPolynomial =
                polynomial(forcing.degree);

            const sinPolynomial =
                polynomial(forcing.degree);

            baseTrial = {
                type: 'Operator',
                operator: '+',
                args: [
                    {
                        type: 'Operator',
                        operator: '*',
                        args: [
                            cosPolynomial,
                            {
                                type: 'Function',
                                name: 'cos',
                                args: [argument]
                            }
                        ]
                    },
                    {
                        type: 'Operator',
                        operator: '*',
                        args: [
                            sinPolynomial,
                            {
                                type: 'Function',
                                name: 'sin',
                                args: [argument]
                            }
                        ]
                    }
                ]
            };
        }

        if (resonanceMultiplicity > 0) {
            baseTrial = {
                type: 'Operator',
                operator: '*',
                args: [
                    xPower(
                        resonanceMultiplicity
                    ),
                    baseTrial
                ]
            };
        }

        return {
            trial:
                this.simplifier.simplify(
                    baseTrial
                ),
            constants
        };
    }

    private complexResonanceMultiplicity(
        coeffs: CanonicalAST[],
        b: Rational
    ): number {
        // Exact second-order test for roots ± i*b:
        // a0 - a2*b² = 0 and a1*b = 0.
        if (coeffs.length !== 3) return 0;

        const a0 = this.parseRat(coeffs[0]);
        const a1 = this.parseRat(coeffs[1]);
        const a2 = this.parseRat(coeffs[2]);

        if (!a0 || !a1 || !a2) return 0;

        const realPart =
            Rat.sub(
                a0,
                Rat.mul(
                    a2,
                    Rat.mul(b, b)
                )
            );

        const imaginaryPart =
            Rat.mul(a1, b);

        return (
            Rat.isZero(realPart) &&
            Rat.isZero(imaginaryPart)
        )
            ? 1
            : 0;
    }

    private solveLinearSystem(A: Rational[][], b: Rational[]): Rational[] | null {
        const n = b.length;
        const aug: Rational[][] = A.map((row, i) => [...row, b[i]]);

        for (let i = 0; i < n; i++) {
            let pivot = i;
            for (let j = i + 1; j < n; j++) {
                if (!Rat.isZero(aug[j][i])) {
                    pivot = j;
                    break;
                }
            }
            if (Rat.isZero(aug[pivot][i])) return null;

            if (pivot !== i) {
                const temp = aug[i];
                aug[i] = aug[pivot];
                aug[pivot] = temp;
            }

            const pivotVal = aug[i][i];
            for (let j = i; j <= n; j++) {
                aug[i][j] = Rat.div(aug[i][j], pivotVal);
            }

            for (let k = 0; k < n; k++) {
                if (k !== i) {
                    const factor = aug[k][i];
                    for (let j = i; j <= n; j++) {
                        aug[k][j] = Rat.sub(aug[k][j], Rat.mul(factor, aug[i][j]));
                    }
                }
            }
        }

        return aug.map(row => row[n]);
    }

    private parseRat(ast: CanonicalAST): Rational | null {
        if (ast.type === 'Number') {
            if (ast.value.includes('/')) {
                const [n, d] = ast.value.split('/');
                return Rat.simplify({ num: BigInt(n), den: BigInt(d) });
            }
            return { num: BigInt(ast.value), den: 1n };
        }
        if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
            const sub = this.parseRat(ast.args[1]);
            if (sub) return { num: -sub.num, den: sub.den };
        }
        return null;
    }

    private ratToAST(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        if (sim.num < 0n) return { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '0' }, { type: 'Operator', operator: '/', args: [{ type: 'Number', value: (-sim.num).toString() }, { type: 'Number', value: sim.den.toString() }] }] };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }
}

