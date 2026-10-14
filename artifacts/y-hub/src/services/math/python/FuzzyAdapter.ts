import { FuzzyInferenceRequest, FuzzyResult } from '../fuzzy/types';
import { PHASE_MATH_ENDPOINT, postPhaseMath } from './phaseClient';

export class FuzzyAdapter {
    private endpoint: string;

    constructor(endpoint: string = PHASE_MATH_ENDPOINT) {
        this.endpoint = endpoint;
    }

    public async executePythonFuzzy(req: FuzzyInferenceRequest): Promise<FuzzyResult | null> {
        const data = await postPhaseMath(this.endpoint, {
            operation: 'fuzzy_inference', phase: 'fuzzy',
            mode: 'numerical', input: req,
        }, 10000);
        if (!data || (data.status !== 'solved' && data.status !== 'completed')) return null;
        // Inference must return an actual crisp-output object, not an empty stub.
        if (!data.result || typeof data.result !== 'object' || Array.isArray(data.result)) return null;
        return {
            crispOutputs: data.result as FuzzyResult['crispOutputs'],
            provider: 'python',
            exactness: data.exactness || 'numerical_approximation',
            verificationStatus: (data.verification_status || 'not_proven') as FuzzyResult['verificationStatus'],
            trace: (data.steps || []) as FuzzyResult['trace'],
            warnings: data.warnings || [],
        };

    }
}
