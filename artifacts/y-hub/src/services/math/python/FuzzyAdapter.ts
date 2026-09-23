import { FuzzyInferenceRequest, FuzzyResult } from '../fuzzy/types';

export class FuzzyAdapter {
    private endpoint: string;

    constructor(endpoint: string = 'http://localhost:8000/api/v1/math/compute') {
        this.endpoint = endpoint;
    }

    public async executePythonFuzzy(req: FuzzyInferenceRequest): Promise<FuzzyResult | null> {
        try {
            const payload = {
                operation: 'fuzzy_inference',
                phase: 'fuzzy',
                mode: 'numerical',
                input: req
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) return null;

            const data = await res.json();
            
            if (data.status === 'solved' || data.status === 'completed') {
                return {
                    crispOutputs: data.result || {},
                    provider: 'python',
                    exactness: data.exactness || 'numerical_approximation',
                    verificationStatus: data.verification_status || 'not_proven',
                    trace: data.steps || [],
                    warnings: data.warnings || []
                };
            }
            return null;
        } catch(e) {
            return null; 
        }
    }
}
