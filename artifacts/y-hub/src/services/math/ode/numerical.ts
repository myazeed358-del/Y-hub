import { CanonicalAST } from '../types/ast';
import { ODERequest, NumericalODEResult } from '../types/ode';
import { DomainAnalyzer } from '../domain';
import { ASTEvaluator } from '../symbolic/evaluator';

export class NumericalODEEngine {
    private domainAnalyzer = new DomainAnalyzer();

    public solve(req: ODERequest, explicitDeriv: CanonicalAST): NumericalODEResult | null {
        if (!req.numericalConfig || !req.initialCondition) return null;

        const { method, stepSize, steps } = req.numericalConfig;
        
        // Evaluate x0, y0 as numbers
        const x0 = this.evalAST(req.initialCondition.x0);
        const y0 = this.evalAST(req.initialCondition.y0);
        
        const order = req.higherDerivatives ? req.higherDerivatives.length + 1 : 1;
        
        // initial state vector Y = [y0, y'0, ..., y^(n-1)0]
        const Y0: number[] = [y0];
        if (order > 1 && req.initialCondition.derivatives) {
            for (let i = 0; i < order - 1; i++) {
                if (req.initialCondition.derivatives[i]) {
                    Y0.push(this.evalAST(req.initialCondition.derivatives[i]));
                } else {
                    Y0.push(0); // fallback
                }
            }
        } else if (order > 1) {
            for (let i = 0; i < order - 1; i++) Y0.push(0);
        }
        
        if (isNaN(x0) || Y0.some(isNaN) || !isFinite(x0) || Y0.some(v => !isFinite(v))) {
            return {
                method, initialCondition: { x0: NaN, y0: NaN }, stepSize, points: [], finalValue: null, evaluationCount: 0, convergenceStatus: 'invalid_step'
            };
        }

        if (stepSize === 0 || isNaN(stepSize) || !isFinite(stepSize) || steps <= 0 || steps > 10000) {
            return {
                method, initialCondition: { x0, y0: Y0[0] }, stepSize, points: [], finalValue: null, evaluationCount: 0, convergenceStatus: 'invalid_step'
            };
        }

        let evalCount = 0;
        let status: NumericalODEResult['convergenceStatus'] = 'completed';

        const evaluator = new ASTEvaluator();

        const f = (xVal: number, YVal: number[]): number[] => {
            const points: Record<string, number> = {
                [req.independentVariable]: xVal,
                [req.dependentVariable]: YVal[0]
            };
            
            if (order > 1) {
                points[req.derivativeVariable] = YVal[1];
                if (req.higherDerivatives) {
                    for (let i = 0; i < req.higherDerivatives.length - 1; i++) {
                        points[req.higherDerivatives[i]] = YVal[i+2];
                    }
                }
            }
            
            const highestDeriv = evaluator.evaluate(explicitDeriv, points);
            evalCount++;
            
            const dY = [];
            for (let i = 0; i < order - 1; i++) {
                dY.push(YVal[i+1]);
            }
            dY.push(highestDeriv);
            
            return dY;
        };
        
        const addV = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
        const scaleV = (a: number[], s: number) => a.map(v => v * s);

        const runTrajectory = (h: number, n: number) => {
            let cx = x0;
            let cY = [...Y0];
            const cPoints = [{ x: cx, y: cY[0] }];
            
            for (let i = 0; i < n; i++) {
                let YNext = [...cY];
                if (method === 'euler') {
                    const k1 = f(cx, cY);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    YNext = addV(cY, scaleV(k1, h));
                } else if (method === 'heun') {
                    const k1 = f(cx, cY);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k2 = f(cx + h, addV(cY, scaleV(k1, h)));
                    if (k2.some(v => !isFinite(v))) throw new Error('non_finite');
                    YNext = addV(cY, scaleV(addV(k1, k2), h / 2));
                } else if (method === 'rk4') {
                    const k1 = f(cx, cY);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k2 = f(cx + h / 2, addV(cY, scaleV(k1, h / 2)));
                    if (k2.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k3 = f(cx + h / 2, addV(cY, scaleV(k2, h / 2)));
                    if (k3.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k4 = f(cx + h, addV(cY, scaleV(k3, h)));
                    if (k4.some(v => !isFinite(v))) throw new Error('non_finite');
                    
                    YNext = addV(cY, scaleV(addV(addV(k1, scaleV(k2, 2)), addV(scaleV(k3, 2), k4)), h / 6));
                }
                cx += h;
                cY = YNext;
                cPoints.push({ x: cx, y: cY[0] });
                if (cY.some(v => !isFinite(v))) throw new Error('non_finite');
            }
            return { points: cPoints, finalY: cY[0] };
        };

        let points: { x: number, y: number }[] = [];
        let finalY: number | null = null;
        try {
            // Run with h
            const resH = runTrajectory(stepSize, steps);
            
            // Run with h/2 for tolerance check
            const resH2 = runTrajectory(stepSize / 2, steps * 2);
            
            points = resH.points; // we return the requested points
            finalY = resH.finalY;
            
            const tol = 1e-4; // standard relative/absolute tolerance check
            const diff = Math.abs(resH.finalY - resH2.finalY);
            if (diff < tol || diff / Math.abs(resH.finalY) < tol) {
                status = 'tolerance_met';
            } else {
                status = 'tolerance_not_met';
            }
        } catch (e: any) {
            if (e.message === 'non_finite') {
                status = 'non_finite_evaluation';
            } else {
                status = 'domain_failure';
            }
        }

        return {
            method,
            initialCondition: { x0, y0: Y0[0] },
            stepSize,
            points,
            finalValue:
                (status === 'tolerance_met' ||
                 status === 'tolerance_not_met')
                    ? finalY
                    : null,
            evaluationCount: evalCount,
            convergenceStatus: status
        };
    }

    private evalAST(node: CanonicalAST): number {
        if (node.type === 'Number') return parseFloat(node.value);
        if (node.type === 'Operator' && node.operator === '-' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '0') {
            return -this.evalAST(node.args[1]); // e.g. -1
        }
        return NaN;
    }
}

import { SystemODERequest, SystemNumericalResult } from '../types/ode';

// Extension of NumericalODEEngine
export class SystemNumericalODEEngine {
    public solveSystem(req: SystemODERequest): SystemNumericalResult | null {
        if (!req.numericalConfig || !req.initialCondition) return null;

        const { method, stepSize, steps } = req.numericalConfig;
        
        const evaluator = new ASTEvaluator();
        
        const t0 = this.evalAST(req.initialCondition.t0);
        const X0 = req.initialCondition.X0.map(ast => this.evalAST(ast));
        
        if (isNaN(t0) || X0.some(isNaN) || !isFinite(t0) || X0.some(v => !isFinite(v))) {
            return {
                method, initialCondition: { t0: NaN, X0: [] }, stepSize, points: [], finalValue: null, evaluationCount: 0, convergenceStatus: 'invalid_step'
            };
        }

        const n = req.dependentVariables.length;
        
        // Extract rhs for each equation
        const rhsASTs = req.equations.map(eq => eq.type === 'Equation' ? (eq as any).rhs : eq);

        let evalCount = 0;
        
        const f = (tVal: number, XVal: number[]): number[] => {
            const points: Record<string, number> = {
                [req.independentVariable]: tVal
            };
            for (let i = 0; i < n; i++) {
                points[req.dependentVariables[i]] = XVal[i];
            }
            
            const dX = [];
            for (let i = 0; i < n; i++) {
                dX.push(evaluator.evaluate(rhsASTs[i], points));
            }
            evalCount++;
            return dX;
        };

        const addV = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
        const scaleV = (a: number[], s: number) => a.map(v => v * s);

        const runTrajectory = (h: number, nSteps: number) => {
            let ct = t0;
            let cX = [...X0];
            const cPoints = [{ t: ct, X: cX }];
            
            for (let i = 0; i < nSteps; i++) {
                let XNext = [...cX];
                if (method === 'euler') {
                    const k1 = f(ct, cX);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    XNext = addV(cX, scaleV(k1, h));
                } else if (method === 'heun') {
                    const k1 = f(ct, cX);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k2 = f(ct + h, addV(cX, scaleV(k1, h)));
                    if (k2.some(v => !isFinite(v))) throw new Error('non_finite');
                    XNext = addV(cX, scaleV(addV(k1, k2), h / 2));
                } else if (method === 'rk4') {
                    const k1 = f(ct, cX);
                    if (k1.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k2 = f(ct + h / 2, addV(cX, scaleV(k1, h / 2)));
                    if (k2.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k3 = f(ct + h / 2, addV(cX, scaleV(k2, h / 2)));
                    if (k3.some(v => !isFinite(v))) throw new Error('non_finite');
                    const k4 = f(ct + h, addV(cX, scaleV(k3, h)));
                    if (k4.some(v => !isFinite(v))) throw new Error('non_finite');
                    
                    XNext = addV(cX, scaleV(addV(addV(k1, scaleV(k2, 2)), addV(scaleV(k3, 2), k4)), h / 6));
                }
                ct += h;
                cX = XNext;
                cPoints.push({ t: ct, X: cX });
                if (cX.some(v => !isFinite(v))) throw new Error('non_finite');
            }
            return { points: cPoints, finalX: cX };
        };

        let points: { t: number, X: number[] }[] = [];
        let finalX: number[] | null = null;
        let status: any = 'completed';

        try {
            const resH = runTrajectory(stepSize, steps);
            const resH2 = runTrajectory(stepSize / 2, steps * 2);
            
            points = resH.points;
            finalX = resH.finalX;
            
            const tol = 1e-4;
            let maxDiff = 0;
            let maxVal = 0;
            for (let i = 0; i < n; i++) {
                maxDiff = Math.max(maxDiff, Math.abs(resH.finalX[i] - resH2.finalX[i]));
                maxVal = Math.max(maxVal, Math.abs(resH.finalX[i]));
            }
            
            if (maxDiff < tol || (maxVal > 0 && maxDiff / maxVal < tol)) {
                status = 'tolerance_met';
            } else {
                status = 'tolerance_not_met';
            }
        } catch (e: any) {
            if (e.message === 'non_finite') status = 'non_finite_evaluation';
            else status = 'domain_failure';
        }

        return {
            method,
            initialCondition: { t0, X0 },
            stepSize,
            points,
            finalValue: (status === 'tolerance_met' || status === 'tolerance_not_met' || status === 'completed') ? finalX : null,
            evaluationCount: evalCount,
            convergenceStatus: status
        };
    }

    private evalAST(node: CanonicalAST): number {
        if (node.type === 'Number') return parseFloat(node.value);
        if (node.type === 'Operator' && node.operator === '-' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '0') {
            return -this.evalAST(node.args[1]);
        }
        return NaN;
    }
}

