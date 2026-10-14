import { LinearSystemODEEngine } from './system_linear';
import { SystemIVPEngine } from './system_ivp';
import { PhasePlaneEngine } from './phase_plane';
import { SystemODERequest, SystemODEResult, ODEStep } from '../types/ode';
import { ODEAdapter } from '../python/ODEAdapter';

export class SystemODEOrchestrator {
    private adapter = new ODEAdapter();

    public async executeAsync(req: SystemODERequest): Promise<SystemODEResult> {
    try {
        const pyRes = await this.adapter.executePythonSystemODE(req);
        if (pyRes !== null) {
            if (pyRes.status === 'exact_symbolic' || pyRes.status === 'numerical_approximation' || pyRes.status === 'unsupported' || pyRes.classification === 'unsupported') {
                (pyRes as any).provider = 'python';
                return pyRes;
            }
        }
    } catch(e) {}
    const tsRes = this.solveSystem(req);
    (tsRes as any).provider = 'fallback_typescript';
    return tsRes;
}
    private linearSystemEngine = new LinearSystemODEEngine();
    private systemIVPEngine = new SystemIVPEngine();
    private phasePlaneEngine = new PhasePlaneEngine();

    public solveSystem(req: SystemODERequest): SystemODEResult {
        const trace: ODEStep[] = [];
        const warnings: string[] = [];

        try {
            const linearRes = this.linearSystemEngine.solve(req);
            if (linearRes) {
                trace.push(...linearRes.steps);

                let classification: any = 'LINEAR_SYSTEM';
                if (linearRes.explanationData && linearRes.explanationData.forcing_vector) {
                    const G = linearRes.explanationData.forcing_vector;
                    const isHomo = G.every((g: any) => g.type === 'Number' && g.value === '0');
                    if (isHomo) classification = 'CONSTANT_COEFFICIENT_SYSTEM';
                    else classification = 'NONHOMOGENEOUS_SYSTEM';
                }

                let particularSolution = undefined;
                let validity: any = undefined;

                if (req.initialCondition) {
                    const ivpRes = this.systemIVPEngine.solve(req, linearRes.solutions);
                    if (ivpRes.particularSolution) {
                        particularSolution = ivpRes.particularSolution;
                        validity = ivpRes.validity;
                        classification = 'SYSTEM_IVP';

                        trace.push({
                            strategy: 'System IVP',
                            inputExpression: req.equations[0],
                            transformation: 'Solved exact constants for initial condition',
                            resultingExpression: req.equations[0]
                        });
                    }
                }

                let phasePlane = undefined;
                if (req.mode === 'qualitative' || !req.initialCondition) {
                    if (linearRes.explanationData && linearRes.explanationData.coefficient_matrix) {
                        const pp = this.phasePlaneEngine.analyze(req, linearRes.explanationData.coefficient_matrix);
                        if (pp) {
                            phasePlane = pp;
                            classification = classification === 'SYSTEM_IVP' ? classification : 'PHASE_PLANE_SYSTEM';
                        }
                    }
                }

                return {
                    request: req,
                    classification,
                    solutions: linearRes.solutions,
                    particularSolution,
                    initialConditionValidity: validity,
                    phasePlane,
                    explanationData: linearRes.explanationData,
                    trace,
                    warnings,
                    status: 'exact_symbolic'
                };
            }
        } catch(e: any) {
            if (e.message === 'resource_limit') {
                return { request: req, classification: 'unsupported', solutions: [], trace, warnings, status: 'resource_limit' };
            }
        }

        return { request: req, classification: 'unsupported', solutions: [], trace, warnings, status: 'unsupported' };
    }
}
