import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalAST } from '../../types/ast';
import type { LinearAlgebraRequest } from '../../linear_algebra/types';
import { LinearAlgebraAdapter } from '../LinearAlgebraAdapter';
import { fromPythonScalar, toPythonMatrix } from '../linearAlgebraMapping';
import { postPhaseMath } from '../phaseClient';

const num = (value: string): CanonicalAST => ({ type: 'Number', value });
const request = (operation: string, mode: LinearAlgebraRequest['mode'] = 'exact'): LinearAlgebraRequest => ({
  operation,
  mode,
  matrices: [[[num('1'), num('2')], [num('3'), num('4')]]],
});
const api = (operation: string, result: unknown, status = 'solved') => ({
  operation, phase: '10', mode: 'exact', status, result,
  exactness: 'exact_symbolic', errors: [], steps: [], warnings: [],
});
function mockFetch(body: unknown) {
  const mocked = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
  vi.stubGlobal('fetch', mocked);
  return mocked;
}
afterEach(() => vi.unstubAllGlobals());

describe('Python linear algebra boundary', () => {
  it('never silently replaces symbolic expressions with zero', async () => {
    const fetchMock = mockFetch(api('determinant', 0));
    const bad = request('determinant');
    bad.matrices[0][0][0] = { type: 'Symbol', name: 'x' };
    expect(toPythonMatrix(bad.matrices[0], false)).toBeNull();
    expect(await new LinearAlgebraAdapter().executePython(bad)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves exact rational signs while preparing Python input', () => {
    const negative: CanonicalAST = { type: 'Operator', operator: '-', args: [
      num('0'), { type: 'Operator', operator: '/', args: [num('1'), num('3')] },
    ] };
    expect(toPythonMatrix([[negative]], false)).toEqual([['-1/3']]);
    expect(fromPythonScalar('-2/3')).toEqual({ type: 'Operator', operator: '-', args: [
      num('0'), { type: 'Operator', operator: '/', args: [num('2'), num('3')] },
    ] });
  });

  it('maps determinant into the domain resultScalar', async () => {
    mockFetch(api('determinant', '-2/3'));
    const result = await new LinearAlgebraAdapter().executePython(request('determinant'));
    expect(result?.status).toBe('solved');
    expect(result?.resultScalar).toEqual(fromPythonScalar('-2/3'));
  });

  it('maps matrix results without losing exact fractions', async () => {
    mockFetch(api('inverse', [['1/2', '0'], ['0', '-3/2']]));
    const result = await new LinearAlgebraAdapter().executePython(request('inverse'));
    expect(result?.resultMatrix).toEqual([
      [fromPythonScalar('1/2'), num('0')],
      [num('0'), fromPythonScalar('-3/2')],
    ]);
  });

  it('rejects an incomplete or mismatched success response', async () => {
    mockFetch(api('rref', null));
    expect(await new LinearAlgebraAdapter().executePython(request('rref'))).toBeNull();
    mockFetch({ ...api('rref', [[1]]), operation: 'determinant' });
    expect(await new LinearAlgebraAdapter().executePython(request('rref'))).toBeNull();
  });

  it('does not accept eigen or solve-system shells without complete mappings', async () => {
    const fetchMock = mockFetch(api('eigen', { eigenvalues: [] }));
    expect(await new LinearAlgebraAdapter().executePython(request('eigen'))).toBeNull();
    expect(await new LinearAlgebraAdapter().executePython(request('solve_system'))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a numerical SVD into the SVD result contract', async () => {
    mockFetch({ ...api('svd', {
      U: [[1, 0], [0, 1]], Sigma: [3, 2],
      V: [[1, 0], [0, 1]], rank: 2,
    }), exactness: 'numerical_approximation' });
    const result = await new LinearAlgebraAdapter().executePython(request('svd', 'numerical'));
    expect(result?.svd?.Sigma).toEqual([3, 2]);
    expect(result?.exactness).toBe('numerical_approximation');
  });

  it('rejects invalid contract responses before they reach adapters', async () => {
    mockFetch({ status: 'solved', result: [42], operation: 'wrong', phase: '10' });
    const result = await postPhaseMath('http://localhost/test', {
      operation: 'rref', phase: '10', mode: 'exact', input: {},
    }, 100);
    expect(result).toBeNull();
  });
});
