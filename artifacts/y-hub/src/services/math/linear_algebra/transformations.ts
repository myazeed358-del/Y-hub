import { ExactMatrix, VectorSpaceInfo } from './types';
import { VectorSpaceEngine } from './vector_space';
import { LAMatrix } from './matrix';

export class TransformationEngine {
    public static kernel(A: ExactMatrix): VectorSpaceInfo {
        return VectorSpaceEngine.nullSpace(A);
    }

    public static range(A: ExactMatrix): VectorSpaceInfo {
        return VectorSpaceEngine.colSpace(A);
    }

    public static injectivity(A: ExactMatrix): boolean {
        const ker = this.kernel(A);
        return ker.dimension === 0;
    }

    public static surjectivity(A: ExactMatrix): boolean {
        const m = A.length;
        const rng = this.range(A);
        return rng.dimension === m;
    }

    public static similarity(A: ExactMatrix, P: ExactMatrix): ExactMatrix | null {
        const P_inv = LAMatrix.inverse(P);
        if (!P_inv) return null;
        return LAMatrix.multiply(LAMatrix.multiply(P_inv, A), P);
    }
}

