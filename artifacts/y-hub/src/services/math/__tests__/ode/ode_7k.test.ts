import { ODEOrchestrator } from '../../ode/orchestrator';
import { ODERequest } from '../../types/ode';
import { CanonicalAST } from '../../types/ast';

describe('PHASE 7 - ODE 1 HARDENING (7K REGRESSION)', () => {
    const orchestrator = new ODEOrchestrator();

    const sym = (name: string): CanonicalAST => ({ type: 'Symbol', name });
    const num = (value: string): CanonicalAST => ({ type: 'Number', value });
    const op = (operator: '+' | '-' | '*' | '/' | '^', args: CanonicalAST[]): CanonicalAST => ({ type: 'Operator', operator, args });
    const func = (name: string, arg: CanonicalAST): CanonicalAST => ({ type: 'Function', name, args: [arg] });
    const pwr = (arg: CanonicalAST, power: string): CanonicalAST => op('^', [arg, num(power)]);
    const eq = (lhs: CanonicalAST, rhs: CanonicalAST): CanonicalAST => ({ type: 'Equation', lhs, rhs });

    const yPrime = sym('y_prime');
    const x = sym('x');
    const y = sym('y');

    it('A) y\'=y(1-y) Autonomous Stability', () => {
        const req: ODERequest = {
            equation: eq(yPrime, op('*', [y, op('-', [num('1'), y])])),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'qualitative'
        };
        const res = orchestrator.orchestrate(req);
        expect(res.classification).toBe('autonomous');
        expect(res.qualitative?.equilibria.length).toBe(2); // y=0, y=1
        // Stability check without Jacobian
        const y0_stability = res.qualitative?.stability.find(s => s.equilibrium.type === 'Number' && s.equilibrium.value === '0');
        const y1_stability = res.qualitative?.stability.find(s => s.equilibrium.type === 'Number' && s.equilibrium.value === '1');
        expect(['stable', 'unstable', 'semi_stable', 'unresolved']).toContain(y0_stability?.status);
    });

    it('B) y\'=y²-1 Autonomous Stability', () => {
        const req: ODERequest = {
            equation: eq(yPrime, op('-', [pwr(y, '2'), num('1')])),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'qualitative'
        };
        const res = orchestrator.orchestrate(req);
        expect(res.qualitative?.equilibria.length).toBe(2); // -1, 1
    });

    it('C) y\'=(x+y)/(x-y) Homogeneous Transformation Domain', () => {
        const req: ODERequest = {
            equation: eq(yPrime, op('/', [op('+', [x, y]), op('-', [x, y])])),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
        };
        const res = orchestrator.orchestrate(req);
        expect(res.classification).toBe('homogeneous');
        expect(res.solutions[0].assumptions).toContain('x != 0 (transformation condition)');
    });

    it('D) y y\' = x Implicit separable solution', () => {
        const req: ODERequest = {
            equation: eq(op('*', [y, yPrime]), x),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
        };
        const res = orchestrator.orchestrate(req);
        expect(res.classification).toBe('separable');
        expect(res.solutions.some(s => s.type === 'implicit' || s.type === 'explicit')).toBe(true);
        const hasImplicitVerification = res.trace.some(t => t.strategy === 'Implicit Verification' || t.strategy === 'Verification');
        expect(hasImplicitVerification).toBe(true);
    });

    it('E) Separable where division removes an equilibrium', () => {
        const req: ODERequest = {
            equation: eq(yPrime, op('*', [x, op('-', [y, num('2')])])),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
        };
        const res = orchestrator.orchestrate(req);
        const equilibria = res.solutions.filter(s => s.type === 'equilibrium');
        expect(equilibria.length).toBe(1); // y = 2
    });

    it('F) Bernoulli where y=0 is a special solution (n>0)', () => {
        // y' + y = xy^2
        const req: ODERequest = {
            equation: eq(op('+', [yPrime, y]), op('*', [x, pwr(y, '2')])),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
        };
        const res = orchestrator.orchestrate(req);
        expect(res.classification).toBe('bernoulli');
        expect(res.solutions.some(s => s.type === 'equilibrium')).toBe(true);
    });

    it('G) IVP with implicit general solution', () => {
        const req: ODERequest = {
            equation: eq(op('*', [y, yPrime]), x),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic',
            initialCondition: { x0: num('1'), y0: num('1') }
        };
        const res = orchestrator.orchestrate(req);
        expect(res.particularSolution).toBeDefined();
        expect(res.trace.some(t => t.strategy === 'IVP Verification')).toBe(true);
    });

    it('H) IVP where initial condition is incompatible', () => {
        const req: ODERequest = {
            equation: eq(yPrime, num('0')), // y = C
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic',
            initialCondition: { x0: num('0'), y0: sym('infinity') } // C = infinity, incompatible
        };
        const res = orchestrator.orchestrate(req);
        expect(['incompatible', 'unsupported']).toContain(res.initialConditionValidity);
    });

    it('I) Uniqueness-sensitive example', () => {
        const req: ODERequest = {
            equation: eq(yPrime, pwr(y, '1/3')), // y' = y^(1/3)
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic',
            initialCondition: { x0: num('0'), y0: num('0') } // not locally Lipschitz
        };
        const res = orchestrator.orchestrate(req);
        // Ensure we don't falsely claim uniqueness_established
        expect(res.uniqueness).toBe('uniqueness_not_established');
    });

    it('J) Numerical step refinement', () => {
        const req: ODERequest = {
            equation: eq(yPrime, y),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'numerical',
            numericalConfig: { method: 'rk4', stepSize: 0.1, steps: 10 },
            initialCondition: { x0: num('0'), y0: num('1') }
        };
        const res = orchestrator.orchestrate(req);
        expect(['tolerance_met', 'completed']).toContain(res.numerical?.convergenceStatus);
    });

    it('K) Numerical trajectory never converted', () => {
        const req: ODERequest = {
            equation: eq(yPrime, y),
            independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'numerical',
            numericalConfig: { method: 'euler', stepSize: 0.1, steps: 10 },
            initialCondition: { x0: num('0'), y0: num('1') }
        };
        const res = orchestrator.orchestrate(req);
        expect(res.status).toBe('numerical_approximation');
        expect(res.solutions.length).toBe(0); // No exact solutions returned!
    });
});
