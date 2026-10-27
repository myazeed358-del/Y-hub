import { CanonicalAST } from '../types/ast';

import { SymbolicSimplifier } from '../symbolic/simplifier';


import { Rat, Rational } from '../utils/rational';


import { UndeterminedCoefficientsCodec } from './undeterminedCoefficientsCodec';
/** Identifies forcing families and builds resonance-aware particular-solution trials. */
export class ForcingTrialBuilder {
 private readonly codec = new UndeterminedCoefficientsCodec();
 private simplifier = new SymbolicSimplifier();
  public analyzeForcing(
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

        // Check the factors before choosing a trial solution.
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

  public polynomialDegree(
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

  public linearArgumentCoefficient(
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

                const r = this.codec.parseRat(arg);
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

  public buildTrialForForcing(
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
                        this.codec.ratToAST(
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
                    this.codec.ratToAST(
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

  public complexResonanceMultiplicity(
        coeffs: CanonicalAST[],
        b: Rational
    ): number {
        // Exact second-order test for roots ± i*b:
        // a0 - a2*b² = 0 and a1*b = 0.
        if (coeffs.length !== 3) return 0;

        const a0 = this.codec.parseRat(coeffs[0]);
        const a1 = this.codec.parseRat(coeffs[1]);
        const a2 = this.codec.parseRat(coeffs[2]);

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
}
