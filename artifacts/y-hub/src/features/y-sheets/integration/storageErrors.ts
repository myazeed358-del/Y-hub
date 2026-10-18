export class WorkbookStorageError extends Error {
  constructor(public readonly kind: 'conflict' | 'session' | 'invalid' | 'network', message: string) { super(message); }
}
export const isConflict = (error: unknown) => error instanceof WorkbookStorageError
  ? error.kind === 'conflict' : String(error).toLowerCase().includes('conflict');
