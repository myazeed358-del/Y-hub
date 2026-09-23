import { LinearAlgebraRequest, LinearAlgebraResult } from '../linear_algebra/types';
import { CanonicalAST } from '../types/ast';

export class LinearAlgebraAdapter {
    private endpoint: string;

    constructor(endpoint: string = 'http://localhost:8000/api/v1/math/compute') {
        this.endpoint = endpoint;
    }

    public async executePython(req: LinearAlgebraRequest): Promise<LinearAlgebraResult | null> {
        // Only run for explicitly mapped heavy operations.
        const heavyOperations = ['svd', 'eigen', 'inverse', 'solve_system', 'rref', 'lu', 'determinant'];
        if (!heavyOperations.includes(req.operation)) {
            return null; // Fallback to TS native
        }

        try {
            // Convert AST to generic value arrays for SymPy
            const pyMatrices = req.matrices.map(m => this.extractValues(m));
            const pyVectors = req.vectors ? req.vectors.map(v => this.extractVectorValues(v)) : [];

            const payload = {
                operation: req.operation,
                phase: '10',
                mode: req.mode,
                input: {
                    matrices: pyMatrices,
                    vectors: pyVectors
                }
            };

            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                return null; // Silent fallback on network failure
            }

            const data = await res.json();
            
            // Reconstruct the LinearAlgebraResult
            return {
                operation: data.operation,
                status: data.errors && data.errors.length > 0 ? 'invalid_input' : data.status || 'solved',
                exactness: data.exactness,
                explanationSteps: data.steps,
                warnings: data.warnings
                // The actual result mappings (e.g. data.result -> resultMatrix) would be done fully here.
                // For the architecture skeleton, we simply return the mapped shell.
            };

        } catch(e) {
            return null; // Fallback to TS
        }
    }

    private extractValues(matrix: CanonicalAST[][]): any[][] {
        return matrix.map(row => row.map(cell => {
            if (cell.type === 'Number') return cell.value;
            return 0; // simplistic map for AST parsing
        }));
    }

    private extractVectorValues(vector: CanonicalAST[]): any[] {
        return vector.map(cell => {
            if (cell.type === 'Number') return cell.value;
            return 0;
        });
    }
}

