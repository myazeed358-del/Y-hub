import { CanonicalAST } from '../types/ast';
import { SystemODERequest, SystemODEResult, SystemODESolution, ODEStep } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { IntegrationEngine } from '../symbolic/integration';
import { DomainAnalyzer } from '../domain';
import { Rat, Rational } from '../utils/rational';
import { ExactMatrix } from './matrix';
import { ASTUtils } from '../symbolic/utils';

export class LinearSystemODEEngine {
    private simplifier = new SymbolicSimplifier();
    private dEngine = new DerivativeEngine();
    private iEngine = new IntegrationEngine();
    private domainAnalyzer = new DomainAnalyzer();

    public solve(req: SystemODERequest): { solutions: SystemODESolution[], steps: ODEStep[], explanationData?: any } | null {
        if (!req.isSystem || req.dependentVariables.length !== 2) return null;
        
        const [xVar, yVar] = req.dependentVariables;
        const tVar = req.independentVariable;
        
        // Parse X' = AX + G
        const sys = this.parseLinearSystem(req.equations, [xVar, yVar], req.derivativeVariables, tVar);
        if (!sys) return null; // Not a constant coefficient linear system
        
        const { A, G } = sys;
        
        const steps: ODEStep[] = [];
        let expData: any = { coefficient_matrix: A, forcing_vector: G };
        
        // Characteristic polynomial: det(A - lambda I) = lambda^2 - tr(A) lambda + det(A) = 0
        const tr = ExactMatrix.trace2x2(A);
        const det = ExactMatrix.det2x2(A);
        
        // lambda^2 - tr lambda + det = 0
        // D = tr^2 - 4 det
        const tr2 = Rat.mul(tr, tr);
        const fourDet = Rat.mul({num: 4n, den: 1n}, det);
        const D = Rat.sub(tr2, fourDet);
        
        const s = Rat.sign(D);
        const two = {num: 2n, den: 1n};
        
        let Xh: CanonicalAST[]; // [x_h, y_h]
        let matrixExp: CanonicalAST[][] | null = null;
        
        if (s > 0) {
            // Distinct real roots
            const negB_over_2A = Rat.div(tr, two);
            const sqrtD = { type: 'Operator', operator: '^', args: [this.ratToAST(D), { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
            const term2 = { type: 'Operator', operator: '/', args: [sqrtD, this.ratToAST(two)] } as CanonicalAST;
            
            const l1 = { type: 'Operator', operator: '+', args: [this.ratToAST(negB_over_2A), term2] } as CanonicalAST;
            const l2 = { type: 'Operator', operator: '-', args: [this.ratToAST(negB_over_2A), term2] } as CanonicalAST;
            
            // To get eigenvectors, we need to solve (A - lambda I)v = 0
            // Since lambda might contain radicals, we construct it structurally.
            // But if D is a perfect square, we can do exact rational eigenvectors.
            const exactRoots = this.getExactSqrt(D);
            if (exactRoots) {
                const r1 = Rat.add(negB_over_2A, Rat.div(exactRoots, two));
                const r2 = Rat.sub(negB_over_2A, Rat.div(exactRoots, two));
                
                const v1 = ExactMatrix.solveNullspace2x2(ExactMatrix.subtract(A, [[r1, Rat.zero], [Rat.zero, r1]]));
                const v2 = ExactMatrix.solveNullspace2x2(ExactMatrix.subtract(A, [[r2, Rat.zero], [Rat.zero, r2]]));
                
                if (!v1 || !v2) throw new Error('unsupported');
                
                const e1 = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(r1), { type: 'Symbol', name: tVar }] }] });
                const e2 = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(r2), { type: 'Symbol', name: tVar }] }] });
                
                const c1e1 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, e1] } as CanonicalAST;
                const c2e2 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, e2] } as CanonicalAST;
                
                Xh = [
                    this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [c1e1, this.ratToAST(v1[0])] },
                        { type: 'Operator', operator: '*', args: [c2e2, this.ratToAST(v2[0])] }
                    ]}),
                    this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [c1e1, this.ratToAST(v1[1])] },
                        { type: 'Operator', operator: '*', args: [c2e2, this.ratToAST(v2[1])] }
                    ]})
                ];
                expData.eigenvalues = [r1, r2];
                expData.eigenvectors = [v1, v2];
                
                // Matrix exponential Phi(t)
                matrixExp = [
                    [
                        this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, this.ratToAST(v1[0])] }),
                        this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e2, this.ratToAST(v2[0])] })
                    ],
                    [
                        this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, this.ratToAST(v1[1])] }),
                        this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e2, this.ratToAST(v2[1])] })
                    ]
                ];
            } else {
                throw new Error('unsupported'); // Requires radical eigenvalue support
            }
        } else if (s === 0) {
            // Repeated root
            const r = Rat.div(tr, two);
            const A_minus_rI = ExactMatrix.subtract(A, [[r, Rat.zero], [Rat.zero, r]]);
            const isZeroMatrix = Rat.isZero(A_minus_rI[0][0]) && Rat.isZero(A_minus_rI[0][1]) && Rat.isZero(A_minus_rI[1][0]) && Rat.isZero(A_minus_rI[1][1]);
            
            const e1 = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(r), { type: 'Symbol', name: tVar }] }] });
            
            if (isZeroMatrix) {
                // Diagonalizable
                const c1e1 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, e1] } as CanonicalAST;
                const c2e1 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, e1] } as CanonicalAST;
                
                Xh = [c1e1, c2e1];
                expData.eigenvalues = [r, r];
                expData.eigenvectors = [[Rat.one, Rat.zero], [Rat.zero, Rat.one]];
                matrixExp = [
                    [e1, { type: 'Number', value: '0' }],
                    [{ type: 'Number', value: '0' }, e1]
                ];
            } else {
                // Defective. Generalized eigenvector w: (A - rI)w = v
                const v = ExactMatrix.solveNullspace2x2(A_minus_rI);
                if (!v) throw new Error('unsupported');
                
                let w = ExactMatrix.solveLinearSystem(A_minus_rI, v);
                if (!w) {
                    // fallback to pseudo-inverse construction if solveLinearSystem failed due to redundancy
                    if (!Rat.isZero(A_minus_rI[0][1])) {
                        w = [Rat.zero, Rat.div(v[0], A_minus_rI[0][1])];
                    } else if (!Rat.isZero(A_minus_rI[1][0])) {
                        w = [Rat.div(v[1], A_minus_rI[1][0]), Rat.zero];
                    } else {
                        throw new Error('unsupported');
                    }
                }
                
                // X1 = e^(rt) v
                // X2 = e^(rt)(t v + w)
                const c1e1 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, e1] } as CanonicalAST;
                const c2e1 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, e1] } as CanonicalAST;
                const tAST = { type: 'Symbol', name: tVar } as CanonicalAST;
                
                const x1_1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, this.ratToAST(v[0])] });
                const x1_2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, this.ratToAST(v[1])] });
                
                const x2_1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, { type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [tAST, this.ratToAST(v[0])] },
                    this.ratToAST(w[0])
                ]}]});
                
                const x2_2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [e1, { type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [tAST, this.ratToAST(v[1])] },
                    this.ratToAST(w[1])
                ]}]});
                
                Xh = [
                    this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, x1_1] },
                        { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, x2_1] }
                    ]}),
                    this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, x1_2] },
                        { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, x2_2] }
                    ]})
                ];
                
                expData.eigenvalues = [r, r];
                expData.eigenvectors = [v];
                expData.generalized_eigenvectors = [w];
                
                matrixExp = [
                    [x1_1, x2_1],
                    [x1_2, x2_2]
                ];
            }
        } else {
            // Complex conjugate roots: alpha +- i beta
            const alpha = Rat.div(tr, two);
            const negD = { num: -D.num, den: D.den };
            const exactBeta = this.getExactSqrt(negD);
            if (!exactBeta) throw new Error('unsupported');
            const beta = Rat.div(exactBeta, two);
            
            const expPart = this.simplifier.simplify({ type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(alpha), { type: 'Symbol', name: tVar }] }] });
            const cosPart = this.simplifier.simplify({ type: 'Function', name: 'cos', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(beta), { type: 'Symbol', name: tVar }] }] });
            const sinPart = this.simplifier.simplify({ type: 'Function', name: 'sin', args: [{ type: 'Operator', operator: '*', args: [this.ratToAST(beta), { type: 'Symbol', name: tVar }] }] });
            
            // Eigenvector for alpha + i beta is solving (A - (alpha+ibeta)I)(u+iw) = 0
            // Re(eq) = 0, Im(eq) = 0
            const A_minus_alpha = ExactMatrix.subtract(A, [[alpha, Rat.zero], [Rat.zero, alpha]]);
            // A_minus_alpha * u - beta * w = 0
            // beta * u + A_minus_alpha * w = 0
            // Just use formula for 2x2: v = [a12, -a11 + alpha + i beta].
            // If a12 is zero, use [a22 - alpha - i beta, -a21]
            
            let u: Rational[], w: Rational[];
            if (!Rat.isZero(A[0][1])) {
                u = [A[0][1], Rat.sub(alpha, A[0][0])];
                w = [Rat.zero, beta];
            } else if (!Rat.isZero(A[1][0])) {
                u = [Rat.sub(alpha, A[1][1]), A[1][0]];
                w = [Rat.mul({num: -1n, den: 1n}, beta), Rat.zero];
            } else {
                throw new Error('unsupported'); // Diagonal matrix can't have complex roots
            }
            
            // X1 = e^(alpha t) (u cos(beta t) - w sin(beta t))
            // X2 = e^(alpha t) (u sin(beta t) + w cos(beta t))
            
            const makeX = (u: Rational[], w: Rational[], c: CanonicalAST, s: CanonicalAST, idx: number) => {
                const p1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [this.ratToAST(u[idx]), c] });
                const p2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [this.ratToAST(w[idx]), s] });
                return this.simplifier.simplify({ type: 'Operator', operator: '*', args: [expPart, { type: 'Operator', operator: '-', args: [p1, p2] }] });
            };
            
            const makeY = (u: Rational[], w: Rational[], c: CanonicalAST, s: CanonicalAST, idx: number) => {
                const p1 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [this.ratToAST(u[idx]), s] });
                const p2 = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [this.ratToAST(w[idx]), c] });
                return this.simplifier.simplify({ type: 'Operator', operator: '*', args: [expPart, { type: 'Operator', operator: '+', args: [p1, p2] }] });
            };
            
            const x1_1 = makeX(u, w, cosPart, sinPart, 0);
            const x1_2 = makeX(u, w, cosPart, sinPart, 1);
            const x2_1 = makeY(u, w, cosPart, sinPart, 0);
            const x2_2 = makeY(u, w, cosPart, sinPart, 1);
            
            Xh = [
                this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, x1_1] },
                    { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, x2_1] }
                ]}),
                this.simplifier.simplify({ type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, x1_2] },
                    { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, x2_2] }
                ]})
            ];
            
            expData.eigenvalues = [alpha, beta]; // Re, Im
            matrixExp = [
                [x1_1, x2_1],
                [x1_2, x2_2]
            ];
        }
        
        let finalX = Xh;
        const isHomogeneous = (G[0].type === 'Number' && G[0].value === '0') && (G[1].type === 'Number' && G[1].value === '0');
        
        let usedVariationOfParameters = false;

        if (!isHomogeneous) {
            let particularFound = false;

            // Constant forcing G:
            // A*Xp + G = 0  =>  A*Xp = -G.
            //
            // Prefer the exact algebraic particular solution
            // whenever A is invertible and G is rational.
            const g0 = this.parseRat(G[0]);
            const g1 = this.parseRat(G[1]);

            if (
                g0 &&
                g1 &&
                !Rat.isZero(det)
            ) {
                const minusOne: Rational = {
                    num: -1n,
                    den: 1n
                };

                const particularVector =
                    ExactMatrix.solveLinearSystem(
                        A,
                        [
                            Rat.mul(minusOne, g0),
                            Rat.mul(minusOne, g1)
                        ]
                    );

                if (particularVector) {
                    const xp =
                        this.ratToAST(
                            particularVector[0]
                        );

                    const yp =
                        this.ratToAST(
                            particularVector[1]
                        );

                    finalX = [
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [Xh[0], xp]
                        }),
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [Xh[1], yp]
                        })
                    ];

                    expData.particular_solution = [
                        xp,
                        yp
                    ];

                    particularFound = true;
                }
            }

            // General time-dependent forcing fallback:
            // Xp = Phi(t) ∫ Phi(t)^(-1) G(t) dt
            if (!particularFound) {
                usedVariationOfParameters = true;

                if (!matrixExp) {
                    throw new Error('unsupported');
                }

                const p11 = matrixExp[0][0];
                const p12 = matrixExp[0][1];
                const p21 = matrixExp[1][0];
                const p22 = matrixExp[1][1];

                const pdet =
                    this.simplifier.simplify({
                        type: 'Operator',
                        operator: '-',
                        args: [
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [p11, p22]
                            },
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [p12, p21]
                            }
                        ]
                    });

                if (
                    pdet.type === 'Number' &&
                    pdet.value === '0'
                ) {
                    throw new Error('unsupported');
                }

                const inv = [
                    [
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '/',
                            args: [p22, pdet]
                        }),
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '/',
                            args: [
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [
                                        {
                                            type: 'Number',
                                            value: '-1'
                                        },
                                        p12
                                    ]
                                },
                                pdet
                            ]
                        })
                    ],
                    [
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '/',
                            args: [
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [
                                        {
                                            type: 'Number',
                                            value: '-1'
                                        },
                                        p21
                                    ]
                                },
                                pdet
                            ]
                        }),
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '/',
                            args: [p11, pdet]
                        })
                    ]
                ];

                const int1Arg =
                    this.simplifier.simplify({
                        type: 'Operator',
                        operator: '+',
                        args: [
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [
                                    inv[0][0],
                                    G[0]
                                ]
                            },
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [
                                    inv[0][1],
                                    G[1]
                                ]
                            }
                        ]
                    });

                const int2Arg =
                    this.simplifier.simplify({
                        type: 'Operator',
                        operator: '+',
                        args: [
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [
                                    inv[1][0],
                                    G[0]
                                ]
                            },
                            {
                                type: 'Operator',
                                operator: '*',
                                args: [
                                    inv[1][1],
                                    G[1]
                                ]
                            }
                        ]
                    });

                try {
                    const u1 =
                        this.iEngine.integrate(
                            int1Arg,
                            tVar,
                            []
                        );

                    const u2 =
                        this.iEngine.integrate(
                            int2Arg,
                            tVar,
                            []
                        );

                    const xp =
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [p11, u1]
                                },
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [p12, u2]
                                }
                            ]
                        });

                    const yp =
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [p21, u1]
                                },
                                {
                                    type: 'Operator',
                                    operator: '*',
                                    args: [p22, u2]
                                }
                            ]
                        });

                    finalX = [
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [Xh[0], xp]
                        }),
                        this.simplifier.simplify({
                            type: 'Operator',
                            operator: '+',
                            args: [Xh[1], yp]
                        })
                    ];

                    expData.particular_solution = [
                        xp,
                        yp
                    ];
                } catch (e) {
                    throw new Error('unsupported');
                }
            }
        }


        // --- Explicit Verification Step ---
        let vStatus: any = 'not_proven';
        try {
            const dx = this.simplifier.simplify(this.dEngine.differentiate(finalX[0], tVar));
            const dy = this.simplifier.simplify(this.dEngine.differentiate(finalX[1], tVar));
            
            const ax = this.simplifier.simplify({
                type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [this.ratToAST(A[0][0]), finalX[0]] },
                    { type: 'Operator', operator: '*', args: [this.ratToAST(A[0][1]), finalX[1]] }
                ]
            });
            const ay = this.simplifier.simplify({
                type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '*', args: [this.ratToAST(A[1][0]), finalX[0]] },
                    { type: 'Operator', operator: '*', args: [this.ratToAST(A[1][1]), finalX[1]] }
                ]
            });
            
            const ax_plus_g = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [ax, G[0]] });
            const ay_plus_g = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [ay, G[1]] });
            
            const diffX = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [dx, ax_plus_g] });
            const diffY = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [dy, ay_plus_g] });
            
            if (diffX.type === 'Number' && diffX.value === '0' && diffY.type === 'Number' && diffY.value === '0') {
                vStatus = 'exactly_equivalent';
            }
        } catch(e) {}
        
        steps.push({
            strategy: 'Linear System 2x2',
            inputExpression: req.equations[0], // Simplified
            transformation: 'Computed eigenstructure and assembled explicit solution',
            resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: xVar }, rhs: finalX[0] },
            verificationStatus: vStatus
        });
        
        const sol: SystemODESolution = {
            type: 'explicit',
            equations: [
                { type: 'Equation', lhs: { type: 'Symbol', name: xVar }, rhs: finalX[0] },
                { type: 'Equation', lhs: { type: 'Symbol', name: yVar }, rhs: finalX[1] }
            ],
            transformation_domain:
                usedVariationOfParameters
                    ? [{ condition: 'det(Phi) != 0' }]
                    : undefined
        };
        
        return { solutions: [sol], steps, explanationData: expData };
    }

    private getExactSqrt(r: Rational): Rational | null {
        if (r.num < 0n) return null;
        if (r.num === 0n) return Rat.zero;
        
        const iSqrt = (n: bigint): bigint => {
            if (n < 0n) return -1n;
            if (n === 0n) return 0n;
            let x0 = n / 2n;
            if (x0 !== 0n) {
                let x1 = (x0 + n / x0) / 2n;
                while (x1 < x0) {
                    x0 = x1;
                    x1 = (x0 + n / x0) / 2n;
                }
                return x0;
            }
            return 1n;
        };
        
        const numRoot = iSqrt(r.num);
        if (numRoot * numRoot !== r.num) return null;
        const denRoot = iSqrt(r.den);
        if (denRoot * denRoot !== r.den) return null;
        
        return { num: numRoot, den: denRoot };
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

    private parseLinearSystem(eqs: CanonicalAST[], vars: string[], dVars: string[], tVar: string): { A: Rational[][], G: CanonicalAST[] } | null {
        // x' = a x + b y + g1(t)
        // y' = c x + d y + g2(t)
        if (eqs.length !== 2) return null;
        
        const A: Rational[][] = [[Rat.zero, Rat.zero], [Rat.zero, Rat.zero]];
        const G: CanonicalAST[] = [];
        
        for (let i = 0; i < 2; i++) {
            let eq = eqs[i];
            if (eq.type !== 'Equation') return null;
            if (eq.lhs.type !== 'Symbol' || eq.lhs.name !== dVars[i]) {
                // Try rearranging
                if (eq.rhs.type === 'Symbol' && eq.rhs.name === dVars[i]) {
                    eq = { type: 'Equation', lhs: eq.rhs, rhs: eq.lhs };
                } else {
                    return null;
                }
            }
            
            const rhs = this.simplifier.simplify(eq.rhs);
            
            // Extract a, b and g(t)
            const c1 = this.parseRat(this.simplifier.simplify(this.dEngine.differentiate(rhs, vars[0])));
            const c2 = this.parseRat(this.simplifier.simplify(this.dEngine.differentiate(rhs, vars[1])));
            
            if (!c1 || !c2) return null;
            
            A[i][0] = c1;
            A[i][1] = c2;
            
            let g = rhs;
            g = ASTUtils.replaceNode(g, { type: 'Symbol', name: vars[0] }, { type: 'Number', value: '0' });
            g = ASTUtils.replaceNode(g, { type: 'Symbol', name: vars[1] }, { type: 'Number', value: '0' });
            g = this.simplifier.simplify(g);
            
            // Verify structural linearity
            let checkRhs = this.simplifier.simplify({
                type: 'Operator', operator: '+', args: [
                    { type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [this.ratToAST(c1), { type: 'Symbol', name: vars[0] }] },
                        { type: 'Operator', operator: '*', args: [this.ratToAST(c2), { type: 'Symbol', name: vars[1] }] }
                    ]},
                    g
                ]
            });
            
            const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [rhs, checkRhs] });
            if (diff.type !== 'Number' || diff.value !== '0') return null; // Contains non-linear terms
            
            G.push(g);
        }
        
        return { A, G };
    }
}



