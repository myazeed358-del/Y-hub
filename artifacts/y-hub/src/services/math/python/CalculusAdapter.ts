import { CanonicalAST } from '../types/ast';
import { PHASE_MATH_ENDPOINT, postPhaseMath } from './phaseClient';

export class CalculusAdapter {
    private endpoint: string;

    constructor(endpoint: string = PHASE_MATH_ENDPOINT) {
        this.endpoint = endpoint;
    }

    public async executePythonCalculus(operation: string, expression: CanonicalAST, variable: string, lowerBound?: CanonicalAST, upperBound?: CanonicalAST): Promise<any | null> {
        const input: Record<string, unknown> = { expression, variable };
        if (lowerBound) input.lowerBound = lowerBound;
        if (upperBound) input.upperBound = upperBound;
        return postPhaseMath(this.endpoint, {
            operation, phase: '6', mode: 'exact', input,
        }, 5000);

    }
}
