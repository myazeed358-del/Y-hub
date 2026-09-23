import { CanonicalAST } from '../types/ast';
import { ODERequest, ODESolution, ODEStep, ODEOrchestrationContext } from '../types/ode';
import { ODEUtils } from './utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { DomainAnalyzer } from '../analysis/FunctionAnalyzer';

export class SecondOrderLinearODEEngine {
    private odeUtils = new ODEUtils();
    private simplifier = new SymbolicSimplifier();
    private domainAnalyzer = new DomainAnalyzer();

    public solve(req: ODERequest, context: ODEOrchestrationContext): { solutions: ODESolution[], steps: ODEStep[] } | null {
        if (!req.higherDerivatives || req.higherDerivatives.length !== 1) return null; // Must be second order

        const y = req.dependentVariable;
        const x = req.independentVariable;
        const yPrime = req.derivativeVariable;
        const yDoublePrime = req.higherDerivatives[0];

        const linRes = this.odeUtils.isLinearNthOrder(req.equation, y, [yPrime, yDoublePrime]);
        if (!linRes) return null;

        let [a0, a1, a2] = linRes.coeffs;
        let g = linRes.rhs;

        // Check for constant coefficients
        if (a0.type === 'Number' && a1.type === 'Number' && a2.type === 'Number') {
            return this.solveConstantCoeffs(req, a0, a1, a2, g, x, y);
        }
        
        // Cauchy-Euler check
        // a2(x) = A x^2, a1(x) = B x, a0(x) = C
        const parseCE = (ast: CanonicalAST, power: number): CanonicalAST | null => {
            if (power === 0 && ast.type === 'Number') return ast;
            if (power === 1 && ast.type === 'Operator' && ast.operator === '*') {
                if (ast.args[0].type === 'Number' && ast.args[1].type === 'Symbol' && ast.args[1].name === x) return ast.args[0];
                if (ast.args[1].type === 'Number' && ast.args[0].type === 'Symbol' && ast.args[0].name === x) return ast.args[1];
            }
            if (power === 2 && ast.type === 'Operator' && ast.operator === '*') {
                const isX2 = (node: CanonicalAST) => node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === x && node.args[1].type === 'Number' && node.args[1].value === '2';
                if (ast.args[0].type === 'Number' && isX2(ast.args[1])) return ast.args[0];
                if (ast.args[1].type === 'Number' && isX2(ast.args[0])) return ast.args[1];
            }
            return null;
        };

        const A_CE = parseCE(a2, 2);
        const B_CE = parseCE(a1, 1);
        const C_CE = parseCE(a0, 0);

        if (A_CE && B_CE && C_CE) {
            return this.solveCauchyEuler(req, A_CE, B_CE, C_CE, g, x, y);
        }

        return null;
    }

    private solveCauchyEuler(req: ODERequest, a0: CanonicalAST, a1: CanonicalAST, a2: CanonicalAST, g: CanonicalAST, x: string, y: string): { solutions: ODESolution[], steps: ODEStep[] } | null {
        // Parse exact rationals
        const parseRat = (ast: CanonicalAST): {num: bigint, den: bigint} | null => {
            if (ast.type === 'Number') {
                if (ast.value.includes('/')) {
                    const [n, d] = ast.value.split('/');
                    return { num: BigInt(n), den: BigInt(d) };
                }
                return { num: BigInt(ast.value), den: 1n };
            }
            if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
                const sub = parseRat(ast.args[1]);
                if (sub) return { num: -sub.num, den: sub.den };
            }
            return null;
        };

        const A = parseRat(a0);
        const B = parseRat(a1);
        const C = parseRat(a2);

        if (!A || !B || !C || A.num === 0n) return null;

        const isZeroG = g.type === 'Number' && g.value === '0';
        if (!isZeroG) {
            let ypFound = false;
            
            // Try Undetermined Coefficients
            const { UndeterminedCoefficientsEngine } = require('./undetermined_coefficients');
            const ucEngine = new UndeterminedCoefficientsEngine();
            const ucRes = ucEngine.solveParticular(req, g, x, [a0, a1, a2]);
            if (ucRes) {
                steps.push(...ucRes.steps);
                finalY = { type: 'Operator', operator: '+', args: [finalY, ucRes.yp] } as CanonicalAST;
                ypFound = true;
            }
            
            // Fallback to Variation of Parameters
            if (!ypFound) {
                const { VariationOfParametersEngine } = require('./variation_of_parameters');
                const vopEngine = new VariationOfParametersEngine();
                const vopRes = vopEngine.solveParticular(req, y1, y2, g, x);
                if (!vopRes) return null;
                
                steps.push(...vopRes.steps);
                finalY = { type: 'Operator', operator: '+', args: [finalY, vopRes.yp] } as CanonicalAST;
            }
        }

        steps.push({
            strategy: isZeroG ? 'Second-Order Linear Homogeneous (Constant Coefficients)' : 'Second-Order Nonhomogeneous (Constant Coefficients)',
            inputExpression: req.equation,
            transformation: 'Solved characteristic equation and assembled full solution',
            resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY }
        });

        // Exact Arithmetic Helpers
        const add = (a: any, b: any) => ({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
        const sub = (a: any, b: any) => ({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
        const mul = (a: any, b: any) => ({ num: a.num * b.num, den: a.den * b.den });
        const div = (a: any, b: any) => ({ num: a.num * b.den, den: a.den * b.num });
        const sign = (a: any) => a.num * a.den > 0n ? 1 : (a.num === 0n ? 0 : -1);

        const toAST = (r: any): CanonicalAST => {
            if (r.num === 0n) return { type: 'Number', value: '0' };
            const g = (a: bigint, b: bigint): bigint => b === 0n ? (a < 0n ? -a : a) : g(b, a % b);
            const gcd = g(r.num, r.den);
            let n = r.num / gcd;
            let d = r.den / gcd;
            if (d < 0n) { n = -n; d = -d; }
            if (d === 1n) return { type: 'Number', value: n.toString() };
            return { type: 'Operator', operator: '/', args: [
                { type: 'Number', value: n.toString() },
                { type: 'Number', value: d.toString() }
            ]};
        };

        // Characteristic eqn: Ar(r-1) + Br + C = Ar^2 + (B-A)r + C = 0
        const B_minus_A = sub(B, A);
        const D = sub(mul(B_minus_A, B_minus_A), mul({num: 4n, den: 1n}, mul(A, C)));
        const twoA = mul({num: 2n, den: 1n}, A);

        let y1: CanonicalAST;
        let y2: CanonicalAST;

        const s = sign(D);
        if (s > 0) {
            const negB_minus_A_over_2A = div({num: -B_minus_A.num, den: B_minus_A.den}, twoA);
            const D_AST = toAST(D);
            const sqrtD = { type: 'Operator', operator: '^', args: [D_AST, { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
            const twoA_AST = toAST(twoA);
            const term2 = { type: 'Operator', operator: '/', args: [sqrtD, twoA_AST] } as CanonicalAST;

            const r1 = { type: 'Operator', operator: '+', args: [toAST(negB_minus_A_over_2A), term2] } as CanonicalAST;
            const r2 = { type: 'Operator', operator: '-', args: [toAST(negB_minus_A_over_2A), term2] } as CanonicalAST;

            y1 = { type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }, r1] };
            y2 = { type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }, r2] };
        } else if (s === 0) {
            const r = div({num: -B_minus_A.num, den: B_minus_A.den}, twoA);
            const r_AST = toAST(r);
            const powPart = { type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }, r_AST] } as CanonicalAST;
            y1 = powPart;
            y2 = { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }] }, powPart] };
        } else {
            const alpha = div({num: -B_minus_A.num, den: B_minus_A.den}, twoA);
            const negD = { num: -D.num, den: D.den };
            const negD_AST = toAST(negD);
            const sqrtNegD = { type: 'Operator', operator: '^', args: [negD_AST, { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
            const twoA_AST = toAST(twoA);
            const beta = { type: 'Operator', operator: '/', args: [sqrtNegD, twoA_AST] } as CanonicalAST;

            const powPart = { type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }, toAST(alpha)] } as CanonicalAST;
            const cosPart = { type: 'Function', name: 'cos', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }] }] }] } as CanonicalAST;
            const sinPart = { type: 'Function', name: 'sin', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: x }] }] }] }] } as CanonicalAST;

            y1 = { type: 'Operator', operator: '*', args: [powPart, cosPart] };
            y2 = { type: 'Operator', operator: '*', args: [powPart, sinPart] };
        }

        y1 = this.simplifier.simplify(y1);
        y2 = this.simplifier.simplify(y2);

        const yh = {
            type: 'Operator', operator: '+', args: [
                { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, y1] },
                { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, y2] }
            ]
        } as CanonicalAST;

        let finalY = yh;

        steps.push({
            strategy: 'Cauchy-Euler Second-Order Linear Homogeneous',
            inputExpression: req.equation,
            transformation: 'Solved characteristic equation Ar^2 + (B-A)r + C = 0',
            resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY }
        });

        // Solution branches for x>0 and x<0
        const domainP = { type: 'Interval', min: 0, max: Infinity, minInclusive: false, maxInclusive: false };
        const domainN = { type: 'Interval', min: -Infinity, max: 0, minInclusive: false, maxInclusive: false };

        const solP: ODESolution = {
            type: 'explicit',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY },
            domain: domainP as any,
            original_ode_domain: { type: 'Union', sets: [domainP, domainN] } as any,
            transformation_domain: null,
            solution_validity_interval: domainP as any,
            assumptions: [`${x} > 0`]
        };

        const solN: ODESolution = {
            type: 'explicit',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY },
            domain: domainN as any,
            original_ode_domain: { type: 'Union', sets: [domainP, domainN] } as any,
            transformation_domain: null,
            solution_validity_interval: domainN as any,
            assumptions: [`${x} < 0`]
        };

        return { solutions: [solP, solN], steps };
    }
        // Parse exact rationals
        const parseRat = (ast: CanonicalAST): {num: bigint, den: bigint} | null => {
            if (ast.type === 'Number') {
                const parts = ast.value.split('/');
                if (parts.length === 1) {
                    if (ast.value.includes('.')) {
                        const [i, d] = ast.value.split('.');
                        return { num: BigInt(i + d), den: 10n ** BigInt(d.length) };
                    }
                    return { num: BigInt(ast.value), den: 1n };
                }
                if (parts.length === 2) return { num: BigInt(parts[0]), den: BigInt(parts[1]) };
            }
            if (ast.type === 'Operator' && ast.operator === '-' && ast.args.length === 2 && ast.args[0].type === 'Number' && ast.args[0].value === '0') {
                const sub = parseRat(ast.args[1]);
                if (sub) return { num: -sub.num, den: sub.den };
            }
            return null;
        };

        const A = parseRat(a2);
        const B = parseRat(a1);
        const C = parseRat(a0);
        
        if (!A || !B || !C || A.num === 0n) return null;
        
        const steps: ODEStep[] = [];
        const assumptions: string[] = [];
        
        // Exact Arithmetic Helpers
        const add = (a: any, b: any) => ({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
        const sub = (a: any, b: any) => ({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
        const mul = (a: any, b: any) => ({ num: a.num * b.num, den: a.den * b.den });
        const div = (a: any, b: any) => ({ num: a.num * b.den, den: a.den * b.num });
        const sign = (a: any) => a.num * a.den > 0n ? 1 : (a.num === 0n ? 0 : -1);
        
        const toAST = (r: any): CanonicalAST => {
            if (r.num === 0n) return { type: 'Number', value: '0' };
            const g = (a: bigint, b: bigint): bigint => b === 0n ? (a < 0n ? -a : a) : g(b, a % b);
            const gcd = g(r.num, r.den);
            let n = r.num / gcd;
            let d = r.den / gcd;
            if (d < 0n) { n = -n; d = -d; }
            if (d === 1n) return { type: 'Number', value: n.toString() };
            return { type: 'Operator', operator: '/', args: [
                { type: 'Number', value: n.toString() },
                { type: 'Number', value: d.toString() }
            ]};
        };

        const D = sub(mul(B, B), mul({num: 4n, den: 1n}, mul(A, C)));
        const twoA = mul({num: 2n, den: 1n}, A);
        
        let y1: CanonicalAST;
        let y2: CanonicalAST;
        
        const s = sign(D);
        if (s > 0) {
            // Real distinct roots
            const negB_over_2A = div({num: -B.num, den: B.den}, twoA);
            const D_AST = toAST(D);
            const sqrtD = { type: 'Operator', operator: '^', args: [D_AST, { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
            const twoA_AST = toAST(twoA);
            const term2 = { type: 'Operator', operator: '/', args: [sqrtD, twoA_AST] } as CanonicalAST;
            
            const r1 = { type: 'Operator', operator: '+', args: [toAST(negB_over_2A), term2] } as CanonicalAST;
            const r2 = { type: 'Operator', operator: '-', args: [toAST(negB_over_2A), term2] } as CanonicalAST;
            
            y1 = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [r1, { type: 'Symbol', name: x }] }] };
            y2 = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [r2, { type: 'Symbol', name: x }] }] };
        } else if (s === 0) {
            // Real repeated root
            const r = div({num: -B.num, den: B.den}, twoA);
            const r_AST = toAST(r);
            const expPart = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [r_AST, { type: 'Symbol', name: x }] }] } as CanonicalAST;
            y1 = expPart;
            y2 = { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: x }, expPart] };
        } else {
            // Complex roots
            const alpha = div({num: -B.num, den: B.den}, twoA);
            const negD = { num: -D.num, den: D.den };
            const negD_AST = toAST(negD);
            const sqrtNegD = { type: 'Operator', operator: '^', args: [negD_AST, { type: 'Operator', operator: '/', args: [{type: 'Number', value: '1'}, {type: 'Number', value: '2'}] }] } as CanonicalAST;
            const twoA_AST = toAST(twoA);
            const beta = { type: 'Operator', operator: '/', args: [sqrtNegD, twoA_AST] } as CanonicalAST;
            
            const expPart = { type: 'Function', name: 'exp', args: [{ type: 'Operator', operator: '*', args: [toAST(alpha), { type: 'Symbol', name: x }] }] } as CanonicalAST;
            const cosPart = { type: 'Function', name: 'cos', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Symbol', name: x }] }] } as CanonicalAST;
            const sinPart = { type: 'Function', name: 'sin', args: [{ type: 'Operator', operator: '*', args: [beta, { type: 'Symbol', name: x }] }] } as CanonicalAST;
            
            y1 = { type: 'Operator', operator: '*', args: [expPart, cosPart] };
            y2 = { type: 'Operator', operator: '*', args: [expPart, sinPart] };
        }
        
        y1 = this.simplifier.simplify(y1);
        y2 = this.simplifier.simplify(y2);
        
        const yh = {
            type: 'Operator', operator: '+', args: [
                { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C1' }, y1] },
                { type: 'Operator', operator: '*', args: [{ type: 'Symbol', name: 'C2' }, y2] }
            ]
        } as CanonicalAST;
        
        let finalY = yh;
        
        const isZeroG = g.type === 'Number' && g.value === '0';
        if (!isZeroG) {
            // Handled separately or return null for now
            return null;
        }

        steps.push({
            strategy: 'Second-Order Linear Homogeneous (Constant Coefficients)',
            inputExpression: req.equation,
            transformation: 'Solved exact characteristic equation',
            resultingExpression: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY }
        });

        let domainSet = null;
        try {
            const dr = this.domainAnalyzer.analyze(finalY, x);
            if (dr && dr.domain) domainSet = dr.domain;
        } catch(e) {}

        const solution: ODESolution = {
            type: 'explicit',
            equation: { type: 'Equation', lhs: { type: 'Symbol', name: y }, rhs: finalY },
            domain: domainSet,
            original_ode_domain: null,
            transformation_domain: null,
            solution_validity_interval: domainSet,
            assumptions
        };

        return { solutions: [solution], steps };
    }
}

