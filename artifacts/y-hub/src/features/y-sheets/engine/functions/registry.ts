import { CellValue } from '../../types/cell';
import { roundFunction, absFunction, modFunction } from './math';
import {
  sumFunction,
  averageFunction,
  minFunction,
  maxFunction,
  countFunction,
  countaFunction,
} from './statistical';
import { ifFunction, andFunction, orFunction, notFunction } from './logical';

export type FormulaFunction = (args: unknown[]) => CellValue;

class FunctionRegistry {
  private functions = new Map<string, FormulaFunction>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Math
    this.register('ROUND', roundFunction as FormulaFunction);
    this.register('ABS', absFunction as FormulaFunction);
    this.register('MOD', modFunction as FormulaFunction);

    // Statistical
    this.register('SUM', sumFunction);
    this.register('AVERAGE', averageFunction);
    this.register('MIN', minFunction);
    this.register('MAX', maxFunction);
    this.register('COUNT', countFunction);
    this.register('COUNTA', countaFunction);

    // Logical
    this.register('IF', ifFunction);
    this.register('AND', andFunction as FormulaFunction);
    this.register('OR', orFunction as FormulaFunction);
    this.register('NOT', notFunction as FormulaFunction);
  }

  public register(name: string, fn: FormulaFunction): void {
    this.functions.set(name.toUpperCase(), fn);
  }

  public get(name: string): FormulaFunction | undefined {
    return this.functions.get(name.toUpperCase());
  }

  public has(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }

  public getRegisteredNames(): string[] {
    return Array.from(this.functions.keys()).sort();
  }
}

export const functionRegistry = new FunctionRegistry();
