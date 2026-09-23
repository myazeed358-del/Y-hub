import sympy as sp
import numpy as np

def handle_linear_algebra(req):
    op = req.operation
    mode = req.mode
    data = req.input
    
    warnings = []
    errors = []
    steps = []
    result = None
    exactness = 'exact_symbolic'
    
    try:
        if mode == 'exact' or mode == 'auto':
            matrices = [sp.Matrix(m) for m in data.get('matrices', [])]
            vectors = [sp.Matrix(v) for v in data.get('vectors', [])]
            
            if op == 'rref':
                rref_matrix, pivots = matrices[0].rref()
                result = rref_matrix.tolist()
                steps.append({'description': 'Computed RREF via SymPy', 'pivots': list(pivots)})
            
            elif op == 'solve_system':
                A = matrices[0]
                b = vectors[0]
                try:
                    sol = A.LUsolve(b)
                    result = {'systemType': 'unique', 'solution': sol.tolist()}
                except ValueError:
                    # Could be inconsistent or infinitely many
                    aug = A.row_join(b)
                    aug_rref, pivots = aug.rref()
                    if pivots and pivots[-1] == aug.cols - 1:
                        result = {'systemType': 'inconsistent'}
                    else:
                        # Find nullspace for infinitely many solutions
                        ns = A.nullspace()
                        part = A.pinv() * b  # base solution
                        result = {
                            'systemType': 'infinitely_many',
                            'parametricSolution': {
                                'base': part.tolist(),
                                'nullSpaceBasis': [vec.tolist() for vec in ns]
                            }
                        }
            
            elif op == 'inverse':
                try:
                    inv = matrices[0].inv()
                    result = inv.tolist()
                except sp.NonSquareMatrixError:
                    errors.append('Matrix is not square')
                except sp.MatrixError:
                    errors.append('Matrix is singular')
                    
            elif op == 'determinant':
                result = matrices[0].det()
                
            elif op == 'eigen':
                eigenvals = matrices[0].eigenvals()
                eigenvects = matrices[0].eigenvects()
                
                res_eigenvals = []
                for val, mult in eigenvals.items():
                    res_eigenvals.append({'value': str(val), 'algebraicMultiplicity': mult})
                    
                res_eigenvects = []
                for val, mult, basis in eigenvects:
                    for v in basis:
                        res_eigenvects.append({'value': str(val), 'vector': v.tolist()})
                        
                result = {
                    'eigenvalues': res_eigenvals,
                    'eigenvectors': res_eigenvects,
                    'diagonalizable': matrices[0].is_diagonalizable()
                }
                
            else:
                errors.append(f'Operation {op} not fully supported in exact mode yet.')
                
        if mode == 'numerical':
            exactness = 'numerical_approximation'
            matrices = [np.array(m, dtype=float) for m in data.get('matrices', [])]
            
            if op == 'svd':
                U, S, Vh = np.linalg.svd(matrices[0])
                result = {
                    'U': U.tolist(),
                    'Sigma': S.tolist(),
                    'V': Vh.T.tolist(),
                    'rank': int(np.sum(S > 1e-10))
                }
            else:
                errors.append(f'Operation {op} not fully supported in numerical mode yet.')
                
    except Exception as e:
        errors.append(str(e))
        
    status = 'solved' if not errors and result is not None else ('no_solution' if result is None else 'invalid_input')
        
    return {
        'operation': op,
        'phase': '10',
        'mode': mode,
        'input': data,
        'normalized_input': data,
        'result': result,
        'steps': steps,
        'assumptions': None,
        'conditions': [],
        'domain': None,
        'verification': None,
        'verification_status': 'not_proven',
        'exactness': exactness,
        'numerical_evidence': None,
        'warnings': warnings,
        'errors': errors
    }

