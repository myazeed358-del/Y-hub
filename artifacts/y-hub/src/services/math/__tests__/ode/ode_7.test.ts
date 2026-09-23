import { ODEOrchestrator } from '../../ode/orchestrator';
import { ODERequest } from '../../types/ode';
import { CanonicalAST } from '../../types/ast';

describe('PHASE 7 - ODE 1 COMPLETE SYSTEM', () => {
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

    describe('7B SEPARABLE', () => {
        it('1. y\'=xy', () => {
            const req: ODERequest = {
                equation: eq(yPrime, op('*', [x, y])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('separable');
            expect(res.status).toBe('exact_symbolic');
        });

        it('2. y\'=y(1-y) with lost-equilibrium', () => {
            const req: ODERequest = {
                equation: eq(yPrime, op('*', [y, op('-', [num('1'), y])])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('separable');
            const equilibria = res.solutions.filter(s => s.type === 'equilibrium');
            expect(equilibria.length).toBeGreaterThan(0); // Should catch y=0, y=1
        });
        
        it('3. y\'=x/y', () => {
            const req: ODERequest = {
                equation: eq(yPrime, op('/', [x, y])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('separable');
        });
    });

    describe('7C LINEAR', () => {
        it('5. y\'+y=e^x', () => {
            const req: ODERequest = {
                equation: eq(op('+', [yPrime, y]), func('exp', x)),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('linear');
        });

        it('6. y\'-2y=x', () => {
            const req: ODERequest = {
                equation: eq(op('-', [yPrime, op('*', [num('2'), y])]), x),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('linear');
        });
    });

    describe('7D EXACT', () => {
        it('8. Exact eq => y\' = - (2xy+3) / (x²+4y)', () => {
            const numPart = op('+', [op('*', [num('2'), op('*', [x, y])]), num('3')]);
            const denPart = op('+', [pwr(x, '2'), op('*', [num('4'), y])]);
            const req: ODERequest = {
                equation: eq(yPrime, op('*', [num('-1'), op('/', [numPart, denPart])])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('exact');
        });
    });

    describe('7E BERNOULLI', () => {
        it('10. y\'+y=xy²', () => {
            const req: ODERequest = {
                equation: eq(op('+', [yPrime, y]), op('*', [x, pwr(y, '2')])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('bernoulli');
        });
    });

    describe('7F HOMOGENEOUS', () => {
        it('12. y\'=1+y/x', () => {
            const req: ODERequest = {
                equation: eq(yPrime, op('+', [num('1'), op('/', [y, x])])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('homogeneous');
        });
    });

    describe('7G IVP', () => {
        it('14. y\'=y, y(0)=2', () => {
            const req: ODERequest = {
                equation: eq(yPrime, y),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'symbolic',
                initialCondition: { x0: num('0'), y0: num('2') }
            };
            const res = orchestrator.orchestrate(req);
            expect(res.initialConditionValidity).toBe('established');
            expect(res.particularSolution).toBeDefined();
        });
    });

    describe('7H AUTONOMOUS', () => {
        it('17. y\'=y(1-y)', () => {
            const req: ODERequest = {
                equation: eq(yPrime, op('*', [y, op('-', [num('1'), y])])),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'qualitative'
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('autonomous');
            expect(res.qualitative).toBeDefined();
            expect(res.qualitative?.equilibria.length).toBeGreaterThan(0);
        });
    });

    describe('7I NUMERICAL', () => {
        it('20. Euler on y\'=y', () => {
            const req: ODERequest = {
                equation: eq(yPrime, y),
                independentVariable: 'x', dependentVariable: 'y', derivativeVariable: 'y_prime', mode: 'numerical',
                numericalConfig: { method: 'euler', stepSize: 0.1, steps: 10 },
                initialCondition: { x0: num('0'), y0: num('1') }
            };
            const res = orchestrator.orchestrate(req);
            expect(res.classification).toBe('numerical');
            expect(res.numerical).toBeDefined();
            expect(['tolerance_met', 'tolerance_not_met', 'completed']).toContain(res.numerical?.convergenceStatus);
        });
    });
});
