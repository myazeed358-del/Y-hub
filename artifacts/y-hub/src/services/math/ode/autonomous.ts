import { CanonicalAST } from '../types/ast';
import { ODERequest, ODEQualitativeData } from '../types/ode';
import { EquationEngine } from '../symbolic/equation';
import { InequalityEngine } from '../symbolic/inequality';
import { ASTUtils } from '../symbolic/utils';

export class AutonomousODEEngine {
    private eqEngine = new EquationEngine();
    private ineqEngine = new InequalityEngine();

    public analyze(req: ODERequest, explicitDeriv: CanonicalAST): ODEQualitativeData | null {
        if (ASTUtils.containsVariable(explicitDeriv, req.independentVariable)) {
            return null; // Not autonomous
        }

        const y = req.dependentVariable;
        const f_y = explicitDeriv;

        // Equilibria: f(y) = 0
        const eq = { type: 'Equation', lhs: f_y, rhs: { type: 'Number', value: '0' } } as CanonicalAST;
        const sols = this.eqEngine.solveEquation(eq, y);
        const equilibria = sols.filter(s => s.status === 'exact' && s.value && !ASTUtils.isInfinity(s.value)).map(s => s.value!);

        // Sign intervals
        const gt = { type: 'Inequality', operator: '>', lhs: f_y, rhs: { type: 'Number', value: '0' } } as CanonicalAST;
        const lt = { type: 'Inequality', operator: '<', lhs: f_y, rhs: { type: 'Number', value: '0' } } as CanonicalAST;

        const gtRes = this.ineqEngine.solve(gt, y);
        const ltRes = this.ineqEngine.solve(lt, y);

        const signIntervals: { interval: any; sign: 1 | -1 }[] = [];
        if (gtRes.kind === 'solution_set') {
            for (const int of gtRes.solution.intervals) {
                signIntervals.push({ interval: int, sign: 1 });
            }
        }
        if (ltRes.kind === 'solution_set') {
            for (const int of ltRes.solution.intervals) {
                signIntervals.push({ interval: int, sign: -1 });
            }
        }

        // Stability from phase-line sign pattern
        const stability: { equilibrium: CanonicalAST; status: 'stable' | 'unstable' | 'semi_stable' | 'unresolved' }[] = [];
        
        const isExactMatch = (ast: CanonicalAST, endpoint: any): boolean => {
            if (endpoint.type === 'infinity') return false;
            
            // Structural match
            if (ASTUtils.isEqual(ast, endpoint.ast)) return true;
            
            // Exact rational match without float division
            const parseRat = (node: CanonicalAST): {num: number, den: number} | null => {
                if (node.type === 'Number') {
                    const parts = node.value.split('/');
                    if (parts.length === 1) return { num: parseInt(parts[0], 10), den: 1 };
                    if (parts.length === 2) return { num: parseInt(parts[0], 10), den: parseInt(parts[1], 10) };
                }
                if (node.type === 'Operator' && node.operator === '-' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '0') {
                    const sub = parseRat(node.args[1]);
                    if (sub) return { num: -sub.num, den: sub.den };
                }
                return null;
            };
            
            const rat1 = parseRat(ast);
            const rat2 = endpoint.rational;
            if (rat1 && rat2) {
                return BigInt(rat1.num) * BigInt(rat2.den) === BigInt(rat2.num) * BigInt(rat1.den);
            }
            return false;
        };

        for (const eqVal of equilibria) {
            let signLeft: 1 | -1 | 0 = 0;
            let signRight: 1 | -1 | 0 = 0;
            
            for (const s of signIntervals) {
                if (isExactMatch(eqVal, s.interval.right)) {
                    signLeft = s.sign;
                }
                if (isExactMatch(eqVal, s.interval.left)) {
                    signRight = s.sign;
                }
            }

            let status: 'stable' | 'unstable' | 'semi_stable' | 'unresolved' = 'unresolved';
            if (signLeft === 1 && signRight === -1) status = 'stable';
            else if (signLeft === -1 && signRight === 1) status = 'unstable';
            else if ((signLeft === 1 && signRight === 1) || (signLeft === -1 && signRight === -1)) status = 'semi_stable';
            
            stability.push({ equilibrium: eqVal, status });
        }

        return {
            equilibria,
            signIntervals,
            stability
        };
    }
}
