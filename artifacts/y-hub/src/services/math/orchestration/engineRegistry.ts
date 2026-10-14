import type { MathProblemRequest } from '../types/problem';
import type { MathResult } from '../types/result';

/** Independent, complete computation contract for future math-engine plug-ins. */
export interface MathEnginePort {
  readonly id: string;
  /** Must not mutate the incoming request. */
  supports(request: Readonly<MathProblemRequest>): boolean;
  /** Must return a complete MathResult, not a partially populated success shell. */
  execute(request: Readonly<MathProblemRequest>): Promise<MathResult> | MathResult;
}

/**
 * Registry is an optional extension point; the historical orchestration path
 * still runs if no registered engine supports the classified request.
 * The first matching engine wins, in registration order.
 */
export class MathEngineRegistry {
  private readonly engines: MathEnginePort[] = [];

  register(engine: MathEnginePort): this {
    if (!engine || typeof engine.id !== 'string' || !engine.id.trim() ||
        typeof engine.supports !== 'function' || typeof engine.execute !== 'function') {
      throw new TypeError('Invalid math engine port');
    }
    if (this.engines.some(existing => existing.id === engine.id)) {
      throw new Error(`Duplicate math engine: ${engine.id}`);
    }
    this.engines.push(engine);
    return this;
  }

  list(): readonly string[] {
    return this.engines.map(engine => engine.id);
  }

  async execute(request: Readonly<MathProblemRequest>): Promise<MathResult | null> {
    for (const engine of this.engines) {
      if (!engine.supports(request)) continue;
      const result: unknown = await engine.execute(request);
      if (!isCompleteMathResult(result)) {
        throw new TypeError(`Math engine '${engine.id}' returned an incomplete result`);
      }
      return result;
    }
    return null;
  }
}

const ALLOWED_TYPES = new Set([
  'symbolic', 'numeric', 'equation', 'inequality', 'limit',
  'error', 'unsupported',
]);
const ALLOWED_PROVIDERS = new Set([
  'local_ts', 'python_sympy', 'python_scipy', 'api_fallback',
]);

/** Basic runtime guard; specialised result shapes remain TypeScript contracts. */
export function isCompleteMathResult(value: unknown): value is MathResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (!ALLOWED_TYPES.has(String(result.type)) ||
      !ALLOWED_PROVIDERS.has(String(result.engineUsed)) ||
      !Array.isArray(result.steps) || !Array.isArray(result.warnings) ||
      !Array.isArray(result.conditions) ||
      !result.warnings.every(item => typeof item === 'string') ||
      !result.conditions.every(item => typeof item === 'string')) return false;
  switch (result.type) {
    case 'symbolic': return typeof result.expression === 'string' &&
      typeof result.latex === 'string' && typeof result.exact === 'boolean';
    case 'numeric': return Number.isFinite(result.tolerance) &&
      (typeof result.value === 'number'
        ? Number.isFinite(result.value)
        : Array.isArray(result.value) && result.value.every(v => typeof v === 'number' && Number.isFinite(v)));
    case 'equation': return Array.isArray(result.solutions) &&
      Array.isArray(result.rejectedSolutions) && typeof result.completeness === 'string' &&
      typeof result.infiniteSolutions === 'boolean' && typeof result.noSolutions === 'boolean';
    case 'limit': return typeof result.classification === 'string' &&
      typeof result.direction === 'string' && typeof result.strategy === 'string';
    case 'error': return typeof result.errorType === 'string' &&
      typeof result.errorMessage === 'string';
    case 'unsupported': return typeof result.reason === 'string';
    default: return false;
  }
}
