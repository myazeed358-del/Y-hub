
import { ODERequest, ODEResult, ODEStep, ODEClassification } from '../types/ode';


/** An unsupported or incomplete strategy retains its provenance and diagnostic steps. */
export function buildODEResult(req: ODERequest, cls: ODEClassification, status: ODEResult['status'], trace: ODEStep[], warnings: string[]): ODEResult {

        return {
            request: req,
            classification: cls,
            solutions: [],
            trace,
            warnings,
            status
        };

}
