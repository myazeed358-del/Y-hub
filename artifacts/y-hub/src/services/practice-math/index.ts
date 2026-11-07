import { verifyDerivative } from "./polynomialDerivative";
import { verifyAntiderivative } from "./polynomialAntiderivative";
export {
  verifyDerivative,
  parseDerivativeTask,
  verifierVersion,
} from "./polynomialDerivative";
export {
  verifyAntiderivative,
  parseAntiderivativeTask,
} from "./polynomialAntiderivative";
export function verifyPolynomial(value: unknown, language: "ar" | "en") {
  return value &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "polynomial_antiderivative"
    ? verifyAntiderivative(value, language)
    : verifyDerivative(value, language);
}
