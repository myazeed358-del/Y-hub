import { CanonicalAST } from '../types/ast';

export class CalculusAdapter {
    private endpoint: string;

    constructor(endpoint: string = 'http://localhost:8000/api/v1/math/compute') {
        this.endpoint = endpoint;
    }

    public async executePythonCalculus(operation: string, expression: CanonicalAST, variable: string, lowerBound?: CanonicalAST, upperBound?: CanonicalAST): Promise<any | null> {
        try {
            const input: any = {
                expression,
                variable
            };
            if (lowerBound) input.lowerBound = lowerBound;
            if (upperBound) input.upperBound = upperBound;

            const payload = {
                operation, 
                phase: '6',
                mode: 'exact',
                input
            };

            // Use an AbortController for a 5 second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) return null; // service failure -> null -> TS fallback

            const data = await res.json();
            
            // Return the full python response, whether it succeeded or failed mathematically.
            return data;
        } catch(e) {
            return null; // network failure/timeout -> TS fallback
        }
    }
}
