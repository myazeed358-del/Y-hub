/** A stable, typed boundary between the application and an academic calculation engine. */
export interface DomainEnginePort<Input, Output> {
  readonly id: string;
  accepts(input: unknown): input is Input;
  execute(input: Input): Promise<Output>;
}

/**
 * All entry points validate inputs and outputs at runtime, including successful
 * HTTP responses. A missing result is never reported as a successful computation.
 */
export function createDomainEnginePort<Input, Output>(
  id: string,
  accepts: (value: unknown) => value is Input,
  calculate: (input: Input) => Promise<Output> | Output,
  acceptsOutput: (value: unknown) => value is Output,
): DomainEnginePort<Input, Output> {
  if (!id.trim()) throw new TypeError('Engine id must not be blank');
  return Object.freeze({
    id,
    accepts,
    async execute(input: Input): Promise<Output> {
      if (!accepts(input)) throw new TypeError(`Invalid input for engine '${id}'`);
      const output: unknown = await calculate(input);
      if (!acceptsOutput(output)) throw new TypeError(`Incomplete output from engine '${id}'`);
      return output;
    },
  });
}

/**
 * Dynamic discovery intentionally returns unknown: callers must validate the
 * result or use their statically typed DomainEnginePort directly.
 * New engines register without changing the registry implementation.
 */
export class DomainEngineCatalog {
  private readonly entries = new Map<string, DomainEnginePort<never, unknown>>();

  register<Input, Output>(port: DomainEnginePort<Input, Output>): this {
    if (!port || !port.id?.trim() || typeof port.accepts !== 'function' || typeof port.execute !== 'function') {
      throw new TypeError('Invalid domain engine port');
    }
    if (this.entries.has(port.id)) throw new Error(`Duplicate domain engine '${port.id}'`);
    this.entries.set(port.id, port as DomainEnginePort<never, unknown>);
    return this;
  }

  ids(): readonly string[] { return [...this.entries.keys()]; }

  async run(id: string, input: unknown): Promise<unknown> {
    const port = this.entries.get(id);
    if (!port) throw new Error(`Unknown domain engine '${id}'`);
    if (!port.accepts(input)) throw new TypeError(`Invalid input for engine '${id}'`);
    return port.execute(input);
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
