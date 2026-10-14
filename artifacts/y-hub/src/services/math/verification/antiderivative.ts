import type { CanonicalAST } from '../types/ast';
import type { VerificationStatus } from '../types/integration';
import { DerivativeEngine } from '../symbolic/derivative';
import { EquivalenceVerifier } from './equivalence';

/** Validates an antiderivative by differentiating it independently. */
export class AntiderivativeVerifier {
  private readonly derivativeEngine = new DerivativeEngine();
  private readonly equivalenceVerifier = new EquivalenceVerifier();
public verify(
    original: CanonicalAST,
    antideriv: CanonicalAST,
    variable: string
  ): VerificationStatus {
    try {
      const differentiated =
        this.derivativeEngine.differentiate(
          antideriv,
          variable
        );

      return this.equivalenceVerifier.verify(
        original,
        differentiated,
        [variable]
      );
    } catch {
      return 'verification_failed';
    }
  }
}
