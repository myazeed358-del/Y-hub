import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLinearAlgebraRequest,
  solveLinearAlgebra,
} from '../linearAlgebraService';

import { LinearAlgebraAdapter } from '@/services/math/python/LinearAlgebraAdapter';
import { LinearAlgebraAstCodec } from '@/services/math/linear_algebra/astCodec';
import { Rat } from '@/services/math/utils/rational';

describe('Linear Algebra Feature - Application Boundary', () => {
  beforeEach(() => {
    // Keep integration tests deterministic and offline.
    // Only the optional Python adapter is mocked.
    vi.spyOn(
      LinearAlgebraAdapter.prototype,
      'executePython'
    ).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converts matrix values to the engine request contract', () => {
    const request = buildLinearAlgebraRequest({
      operation: 'determinant',
      matrix: [
        ['1/2', '0'],
        ['0', '-3'],
      ],
    });

    expect(request.mode).toBe('exact');
    expect(request.operation).toBe('determinant');
    expect(request.matrices[0][0][0]).toEqual({
      type: 'Number',
      value: '1/2',
    });
  });

  it('rejects invalid entries and zero denominators', () => {
    for (const value of ['abc', '1+2', '1/0', '']) {
      expect(() =>
        buildLinearAlgebraRequest({
          operation: 'determinant',
          matrix: [[value]],
        })
      ).toThrow();
    }
  });

  it('rejects invalid matrix dimensions', () => {
    expect(() =>
      buildLinearAlgebraRequest({
        operation: 'rref',
        matrix: [['1', '2'], ['3']],
      })
    ).toThrow();

    expect(() =>
      buildLinearAlgebraRequest({
        operation: 'inverse',
        matrix: [['1', '2', '3'], ['4', '5', '6']],
      })
    ).toThrow();
  });

  it('requires a compatible vector for linear systems', () => {
    expect(() =>
      buildLinearAlgebraRequest({
        operation: 'solve_system',
        matrix: [['1', '2'], ['3', '4']],
        vector: ['5'],
      })
    ).toThrow();
  });

  it('calculates the determinant with the actual engine', async () => {
    const result = await solveLinearAlgebra({
      operation: 'determinant',
      matrix: [
        ['1', '2'],
        ['3', '4'],
      ],
    });

    expect(result.status).toBe('solved');
    expect(result.resultScalar).toEqual({
      type: 'Number',
      value: '-2',
    });
  });

  it('preserves exact fractional arithmetic', async () => {
    const result = await solveLinearAlgebra({
      operation: 'determinant',
      matrix: [
        ['1/2', '0'],
        ['0', '3'],
      ],
    });

    expect(result.status).toBe('solved');
    expect(result.resultScalar).toBeDefined();

    const codec = new LinearAlgebraAstCodec();
    expect(
      Rat.toString(codec.parseRat(result.resultScalar!))
    ).toBe('3/2');
  });

  it('calculates the inverse matrix exactly', async () => {
    const result = await solveLinearAlgebra({
      operation: 'inverse',
      matrix: [
        ['4', '7'],
        ['2', '6'],
      ],
    });

    expect(result.status).toBe('solved');
    expect(result.resultMatrix).toBeDefined();

    const codec = new LinearAlgebraAstCodec();
    const values = result.resultMatrix!.map(row =>
      row.map(cell => Rat.toString(codec.parseRat(cell)))
    );

    expect(values).toEqual([
      ['3/5', '-7/10'],
      ['-1/5', '2/5'],
    ]);
  });

  it('does not invent an inverse for a singular matrix', async () => {
    const result = await solveLinearAlgebra({
      operation: 'inverse',
      matrix: [
        ['1', '2'],
        ['2', '4'],
      ],
    });

    expect(result.status).toBe('no_solution');
  });

  it('calculates RREF through the engine', async () => {
    const result = await solveLinearAlgebra({
      operation: 'rref',
      matrix: [
        ['1', '2'],
        ['3', '4'],
      ],
    });

    expect(result.status).toBe('completed');
    expect(result.resultMatrix).toEqual([
      [
        { type: 'Number', value: '1' },
        { type: 'Number', value: '0' },
      ],
      [
        { type: 'Number', value: '0' },
        { type: 'Number', value: '1' },
      ],
    ]);
  });

  it('solves a linear system through the real engine', async () => {
    const result = await solveLinearAlgebra({
      operation: 'solve_system',
      matrix: [
        ['2', '1'],
        ['1', '-1'],
      ],
      vector: ['3', '0'],
    });

    expect(result.status).toBe('solved');
    expect(result.linearSystem?.systemType).toBe('unique');

    const solution = result.linearSystem?.solution;
    expect(solution?.map(Rat.toString)).toEqual(['1', '1']);
  });
});
