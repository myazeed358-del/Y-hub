import { LinearAlgebraRequest, LinearAlgebraResult, ExactMatrix, ExactVector } from './types';
import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { EigenEngine } from './eigen';
import { InnerProductEngine } from './inner_product';
import { VectorSpaceEngine } from './vector_space';
import { QuadraticFormEngine } from './quadratic_forms';
import { NumericalLAEngine } from './numerical';
import { LAApplications } from './applications';
import { Rat, Rational } from '../utils/rational';
import { CanonicalAST } from '../types/ast';

import { LinearAlgebraAdapter } from '../python/LinearAlgebraAdapter';

export class LinearAlgebraOrchestrator {
    private adapter = new LinearAlgebraAdapter();

    public async executeAsync(req: LinearAlgebraRequest): Promise<LinearAlgebraResult> {
    try {
        const pyRes = await this.adapter.executePython(req);
        if (pyRes) {
            (pyRes as any).provider = 'python';
            return pyRes;
        }
    } catch(e) {}
    const tsRes = this.execute(req);
    (tsRes as any).provider = 'fallback_typescript';
    return tsRes;
}

    public execute(req: LinearAlgebraRequest): LinearAlgebraResult {
        try {
            const mats = req.matrices.map(m => this.parseMatrix(m));
            const vecs = req.vectors ? req.vectors.map(v => this.parseVector(v)) : [];

            switch (req.operation) {
                case 'solve_system': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const res = SystemSolver.solve(mats[0], vecs[0]);
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', linearSystem: res };
                }
                case 'rref': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const { rref, steps } = LAMatrix.rref(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultMatrix: this.astMatrix(rref), explanationSteps: steps };
                }
                case 'inverse': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const inv = LAMatrix.inverse(mats[0]);
                    if (!inv) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', resultMatrix: this.astMatrix(inv) };
                }
                case 'determinant': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const det = LAMatrix.determinant(mats[0]);
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', resultScalar: this.astRat(det) };
                }
                case 'eigen': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    if (mats[0].length === 2 && mats[0][0].length === 2) {
                        const eigen = EigenEngine.compute2x2(mats[0]);
                        if (!eigen) return { operation: req.operation, status: 'unsupported', exactness: 'exact_symbolic' };
                        return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', eigenStructure: eigen };
                    }
                    return { operation: req.operation, status: 'unsupported', exactness: 'exact_symbolic' };
                }
                case 'least_squares': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const ls = InnerProductEngine.leastSquares(mats[0], vecs[0]);
                    if (!ls) return { operation: req.operation, status: 'unsupported', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.astVector(ls.solution), resultScalar: ls.error };
                }
                case 'gram_schmidt': {
                    if (vecs.length === 0) throw new Error('invalid_input');
                    const gs = InnerProductEngine.gramSchmidt(vecs);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: gs.map(v => this.astVector(v)) };
                }
                case 'definiteness': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const def = QuadraticFormEngine.classify(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: [def] };
                }
                case 'null_space': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const ns = VectorSpaceEngine.nullSpace(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: ns.basis.map(v => this.astVector(v)) };
                }
                case 'leontief': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const leon = LAApplications.leontief(mats[0], vecs[0]);
                    if (!leon) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.astVector(leon) };
                }
                case 'markov_steady_state': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const mkv = LAApplications.markovSteadyState(mats[0]);
                    if (!mkv) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.astVector(mkv) };
                }
                case 'power_method': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const numMats = this.numMatrix(mats[0]);
                    const numVecs = this.numVector(vecs[0]);
                    const res = NumericalLAEngine.powerMethod(numMats, numVecs, 1000, 1e-6);
                    return { operation: req.operation, status: 'completed', exactness: 'numerical_approximation', explanationSteps: [res] };
                }
                case 'lu': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const numMats = this.numMatrix(mats[0]);
                    const res = NumericalLAEngine.luDecomposition(numMats);
                    return { operation: req.operation, status: 'completed', exactness: 'numerical_approximation', explanationSteps: [res] };
                }
                default:
                    return { operation: req.operation, status: 'unsupported', exactness: 'exact_symbolic' };
            }
        } catch(e: any) {
            return { operation: req.operation, status: 'invalid_input', exactness: 'exact_symbolic', warnings: [e.message] };
        }
    }

    private parseMatrix(m: CanonicalAST[][]): ExactMatrix {
        return m.map(row => row.map(cell => this.parseRat(cell)));
    }

    private parseVector(v: CanonicalAST[]): ExactVector {
        return v.map(cell => this.parseRat(cell));
    }

    private parseRat(ast: CanonicalAST): Rational {
        if (ast.type === 'Number') {
            if (ast.value.includes('/')) {
                const [n, d] = ast.value.split('/');
                return Rat.simplify({ num: BigInt(n), den: BigInt(d) });
            }
            return { num: BigInt(ast.value), den: 1n };
        }
        if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
            const sub = this.parseRat(ast.args[1]);
            return { num: -sub.num, den: sub.den };
        }
        throw new Error('Non-constant elements not supported yet in exact linear algebra matrix values');
    }

    private astMatrix(m: ExactMatrix): CanonicalAST[][] {
        return m.map(row => row.map(val => this.astRat(val)));
    }

    private astVector(v: ExactVector): CanonicalAST[] {
        return v.map(val => this.astRat(val));
    }

    private astRat(r: Rational): CanonicalAST {
        const sim = Rat.simplify(r);
        if (sim.den === 1n) return { type: 'Number', value: sim.num.toString() };
        if (sim.num < 0n) return { type: 'Operator', operator: '-', args: [{ type: 'Number', value: '0' }, { type: 'Operator', operator: '/', args: [{ type: 'Number', value: (-sim.num).toString() }, { type: 'Number', value: sim.den.toString() }] }] };
        return { type: 'Operator', operator: '/', args: [{ type: 'Number', value: sim.num.toString() }, { type: 'Number', value: sim.den.toString() }] };
    }

    private numMatrix(m: ExactMatrix): number[][] {
        return m.map(row => row.map(v => Number(v.num) / Number(v.den)));
    }

    private numVector(v: ExactVector): number[] {
        return v.map(v => Number(v.num) / Number(v.den));
    }
}



