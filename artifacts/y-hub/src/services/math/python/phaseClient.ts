import { mathHeaders } from './transportHeaders';
/**
 * Transport for the phase-based FastAPI contract implemented in
 * artifacts/y-hub/python/api/server.py.
 *
 * IMPORTANT: this is a different protocol from PythonMathAdapter's
 * versioned AST endpoint. They intentionally remain separate.
 */
export const PHASE_MATH_ENDPOINT = 'http://localhost:8000/api/v1/math/compute';

export interface PhaseMathRequest {
  operation: string;
  phase: string;
  mode: string;
  input: unknown;
}

export interface PhaseMathResponse {
  operation: string;
  phase: string;
  status: string;
  result: unknown;
  exactness?: 'exact_symbolic' | 'numerical_approximation';
  classification?: string | null;
  steps?: unknown[];
  warnings?: string[];
  errors?: string[];
  verification_status?: string;
}

export async function postPhaseMath(
  endpoint: string,
  payload: PhaseMathRequest,
  timeoutMs: number,
): Promise<PhaseMathResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await mathHeaders() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const obj = data as Record<string, unknown>;
    if (obj.phase !== payload.phase || obj.operation !== payload.operation ||
        typeof obj.status !== 'string' || !('result' in obj)) return null;
    return obj as unknown as PhaseMathResponse;
  } catch {
    // Backend unavailable or malformed; the individual adapter chooses a fallback.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
