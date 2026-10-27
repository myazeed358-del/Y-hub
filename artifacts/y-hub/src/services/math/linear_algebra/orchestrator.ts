import { LinearAlgebraRequest, LinearAlgebraResult } from './types';
import { LAMatrix } from './matrix';
import { SystemSolver } from './system_solver';
import { EigenEngine } from './eigen';
import { InnerProductEngine } from './inner_product';
import { VectorSpaceEngine } from './vector_space';
import { QuadraticFormEngine } from './quadratic_forms';
import { NumericalLAEngine } from './numerical';
import { LAApplications } from './applications';


import { LinearAlgebraAdapter } from '../python/LinearAlgebraAdapter';
import { LinearAlgebraAstCodec } from './astCodec';

export class LinearAlgebraOrchestrator {
    private readonly codec = new LinearAlgebraAstCodec();
    private adapter = new LinearAlgebraAdapter();

    public async executeAsync(req: LinearAlgebraRequest): Promise<LinearAlgebraResult> {
    try {
        const pyRes = await this.adapter.executePython(req);
        if (pyRes) {
            (pyRes as any).provider = 'python';
            return pyRes;
        }
    } catch(e) {}
    // Use the local solver if Python cannot return a result.
    const tsRes = this.execute(req);
    (tsRes as any).provider = 'fallback_typescript';
    return tsRes;
}

    public execute(req: LinearAlgebraRequest): LinearAlgebraResult {
        try {
            const mats = req.matrices.map(m => this.codec.parseMatrix(m));
            const vecs = req.vectors ? req.vectors.map(v => this.codec.parseVector(v)) : [];

            switch (req.operation) {
                case 'solve_system': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const res = SystemSolver.solve(mats[0], vecs[0]);
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', linearSystem: res };
                }
                case 'rref': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const { rref, steps } = LAMatrix.rref(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultMatrix: this.codec.astMatrix(rref), explanationSteps: steps };
                }
                case 'inverse': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const inv = LAMatrix.inverse(mats[0]);
                    if (!inv) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', resultMatrix: this.codec.astMatrix(inv) };
                }
                case 'determinant': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const det = LAMatrix.determinant(mats[0]);
                    return { operation: req.operation, status: 'solved', exactness: 'exact_symbolic', resultScalar: this.codec.astRat(det) };
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
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.codec.astVector(ls.solution), resultScalar: ls.error };
                }
                case 'gram_schmidt': {
                    if (vecs.length === 0) throw new Error('invalid_input');
                    const gs = InnerProductEngine.gramSchmidt(vecs);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: gs.map(v => this.codec.astVector(v)) };
                }
                case 'definiteness': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const def = QuadraticFormEngine.classify(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: [def] };
                }
                case 'null_space': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const ns = VectorSpaceEngine.nullSpace(mats[0]);
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', explanationSteps: ns.basis.map(v => this.codec.astVector(v)) };
                }
                case 'leontief': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const leon = LAApplications.leontief(mats[0], vecs[0]);
                    if (!leon) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.codec.astVector(leon) };
                }
                case 'markov_steady_state': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const mkv = LAApplications.markovSteadyState(mats[0]);
                    if (!mkv) return { operation: req.operation, status: 'no_solution', exactness: 'exact_symbolic' };
                    return { operation: req.operation, status: 'completed', exactness: 'exact_symbolic', resultVector: this.codec.astVector(mkv) };
                }
                case 'power_method': {
                    if (mats.length === 0 || vecs.length === 0) throw new Error('invalid_input');
                    const numMats = this.codec.numMatrix(mats[0]);
                    const numVecs = this.codec.numVector(vecs[0]);
                    const res = NumericalLAEngine.powerMethod(numMats, numVecs, 1000, 1e-6);
                    return { operation: req.operation, status: 'completed', exactness: 'numerical_approximation', explanationSteps: [res] };
                }
                case 'lu': {
                    if (mats.length === 0) throw new Error('invalid_input');
                    const numMats = this.codec.numMatrix(mats[0]);
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


}


