import numpy as np

def validate_matrix(m):
    arr = np.array(m, dtype=float)
    if arr.ndim != 2:
        raise ValueError('Matrix must be 2D')
    if np.any((arr < 0) | (arr > 1)) or not np.all(np.isfinite(arr)):
        raise ValueError('Memberships must be in [0,1]')
    return arr

def compose_relations(A, B, method='max-min'):
    A_arr = validate_matrix(A)
    B_arr = validate_matrix(B)
    
    if A_arr.shape[1] != B_arr.shape[0]:
        raise ValueError('Dimension mismatch for composition.')
        
    A_exp = np.expand_dims(A_arr, axis=2) # (m, n, 1)
    B_exp = np.expand_dims(B_arr, axis=0) # (1, n, p)
    
    if method == 'max-min':
        min_mat = np.minimum(A_exp, B_exp)
        return np.max(min_mat, axis=1) # (m, p)
    elif method == 'max-product':
        prod_mat = A_exp * B_exp
        return np.max(prod_mat, axis=1)
    else:
        raise ValueError('Unsupported composition method')

def transitive_closure(A, limit=100):
    current = validate_matrix(A)
    if current.shape[0] != current.shape[1]:
        raise ValueError('Square matrix required for closure')
        
    converged = False
    iters = 0
    
    for _ in range(limit):
        iters += 1
        comp = compose_relations(current, current, 'max-min')
        next_mat = np.maximum(current, comp)
        
        # Check subset with numerical tolerance
        if np.all(next_mat <= current + 1e-12):
            converged = True
            break
        current = next_mat
        
    return current, iters, converged

def project_relation(A, axis):
    A_arr = validate_matrix(A)
    return np.max(A_arr, axis=axis)

def cylindrical_extension(base, target_dim, axis):
    base_arr = np.array(base, dtype=float)
    if np.any((base_arr < 0) | (base_arr > 1)) or not np.all(np.isfinite(base_arr)):
        raise ValueError('Memberships must be in [0,1]')
        
    if axis == 0:
        # Extend across rows
        res = np.tile(base_arr, (target_dim, 1))
    else:
        # Extend across cols
        res = np.repeat(base_arr[:, np.newaxis], target_dim, axis=1)
    return res
