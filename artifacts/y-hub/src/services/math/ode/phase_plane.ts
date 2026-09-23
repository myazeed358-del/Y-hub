import { CanonicalAST } from '../types/ast';
import { SystemODERequest, SystemPhasePlaneData } from '../types/ode';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { Rat, Rational } from '../utils/rational';
import { ExactMatrix } from './matrix';
import { SystemNumericalODEEngine } from './numerical';

export class PhasePlaneEngine {
    private simplifier = new SymbolicSimplifier();
    private numEngine = new SystemNumericalODEEngine();

    public analyze(req: SystemODERequest, A?: Rational[][]): SystemPhasePlaneData | null {
        if (!req.isSystem || req.dependentVariables.length !== 2) return null;

        const data: SystemPhasePlaneData = { equilibria: [] };
        
        // 1. Symbolic Nullclines
        // x_nullcline: f(x,y) = 0
        // y_nullcline: g(x,y) = 0
        const f_xy = req.equations[0].type === 'Equation' ? (req.equations[0] as any).rhs : req.equations[0];
        const g_xy = req.equations[1].type === 'Equation' ? (req.equations[1] as any).rhs : req.equations[1];
        
        data.nullclines = {
            x_nullcline: this.simplifier.simplify({ type: 'Equation', lhs: f_xy, rhs: { type: 'Number', value: '0' } } as CanonicalAST),
            y_nullcline: this.simplifier.simplify({ type: 'Equation', lhs: g_xy, rhs: { type: 'Number', value: '0' } } as CanonicalAST)
        };

        // 2. Equilibria (exact analytical for linear)
        if (A) {
            const det = ExactMatrix.det2x2(A);
            const tr = ExactMatrix.trace2x2(A);
            
            const tr2 = Rat.mul(tr, tr);
            const fourDet = Rat.mul({num: 4n, den: 1n}, det);
            const D = Rat.sub(tr2, fourDet);
            
            let status: any = 'unresolved';
            let classification = 'unknown';

            if (Rat.isZero(det)) {
                status = 'repeated/degenerate';
                classification = 'line of equilibria';
            } else {
                if (det.num < 0n) {
                    status = 'saddle';
                    classification = 'saddle point';
                } else {
                    if (D.num > 0n) {
                        if (tr.num < 0n) { status = 'stable'; classification = 'stable node'; }
                        else { status = 'unstable'; classification = 'unstable node'; }
                    } else if (D.num < 0n) {
                        if (Rat.isZero(tr)) { status = 'center'; classification = 'center'; }
                        else if (tr.num < 0n) { status = 'stable'; classification = 'stable spiral'; }
                        else { status = 'unstable'; classification = 'unstable spiral'; }
                    } else {
                        if (tr.num < 0n) { status = 'stable'; classification = 'stable improper node'; }
                        else { status = 'unstable'; classification = 'unstable improper node'; }
                    }
                }
            }

            data.equilibria.push({
                point: [{ type: 'Number', value: '0' }, { type: 'Number', value: '0' }],
                classification,
                status
            });
        }

        // 3. Vector Field / Direction Field (numerical sampling evidence)
        const ASTEvaluator = require('../symbolic/evaluator').ASTEvaluator;
        const evaluator = new ASTEvaluator();
        data.vectorField = [];
        
        // simple 5x5 grid from -2 to 2
        for (let x = -2; x <= 2; x++) {
            for (let y = -2; y <= 2; y++) {
                const map = new Map<string, number>();
                map.set(req.dependentVariables[0], x);
                map.set(req.dependentVariables[1], y);
                map.set(req.independentVariable, 0); // Autonomous assumes no t dependence for vector field
                
                try {
                    const dx = evaluator.evaluate(f_xy, map);
                    const dy = evaluator.evaluate(g_xy, map);
                    if (isFinite(dx) && isFinite(dy)) {
                        const mag = Math.sqrt(dx*dx + dy*dy);
                        data.vectorField.push({ x, y, dx, dy, magnitude: mag });
                    }
                } catch(e) {}
            }
        }

        // 4. Trajectories (numerical evidence)
        data.trajectories = [];
        const simReq = { ...req };
        // Launch a couple of test trajectories
        const startPoints = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
        for (const pt of startPoints) {
            simReq.initialCondition = {
                t0: { type: 'Number', value: '0' },
                X0: [{ type: 'Number', value: pt[0].toString() }, { type: 'Number', value: pt[1].toString() }]
            };
            simReq.numericalConfig = { method: 'rk4', stepSize: 0.1, steps: 50 }; // shorter for phase plane sample
            const res = this.numEngine.solveSystem(simReq as SystemODERequest);
            if (res && res.points.length > 0) {
                data.trajectories.push({
                    method: res.method,
                    points: res.points,
                    convergenceStatus: res.convergenceStatus
                });
            }
        }

        return data;
    }
}

