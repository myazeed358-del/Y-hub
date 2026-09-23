import numpy as np

def _eval_membership(x, m_type, params):
    if m_type == 'triangle':
        a, b, c = params['a'], params['b'], params['c']
        if x <= a or x >= c: return 0.0
        if x == b: return 1.0
        return (x - a) / (b - a) if x < b else (c - x) / (c - b)
    if m_type == 'trapezoid':
        a, b, c, d = params['a'], params['b'], params['c'], params['d']
        if x <= a or x >= d: return 0.0
        if b <= x <= c: return 1.0
        return (x - a) / (b - a) if x < b else (d - x) / (d - c)
    if m_type == 'gaussian':
        center, sigma = params['center'], params['sigma']
        return np.exp(-0.5 * ((x - center) / sigma) ** 2)
    return 0.0

def defuzzify_discrete(points, method, input_type=None):
    arr = np.array(points, dtype=float)
    x = arr[:, 0]
    y = arr[:, 1]
    
    if np.any(y < 0):
        return 0, 'invalid_domain'
        
    if method in ['weighted_average', 'weighted_sum'] and input_type != 'singletons':
        return 0, 'invalid_domain'
    
    sum_y = np.sum(y)
    if sum_y == 0 and method in ['centroid', 'bisector', 'weighted_average']:
        return 0, 'zero_area'
        
    if method in ['centroid', 'weighted_average']:
        return float(np.sum(x * y) / sum_y), 'success' # O(N) vectorized loop
    elif method == 'weighted_sum':
        return float(np.sum(x * y)), 'success'
    elif method == 'bisector':
        cum_y = np.cumsum(y)
        target = sum_y / 2.0
        idx = np.abs(cum_y - target).argmin()
        return float(x[idx]), 'success'
    elif method in ['mom', 'som', 'lom']:
        max_y = np.max(y)
        max_indices = np.where(y >= max_y - 1e-12)[0]
        max_x = x[max_indices]
        if method == 'mom':
            return float(np.mean(max_x)), 'success'
        elif method == 'som':
            return float(np.min(max_x)), 'success'
        elif method == 'lom':
            return float(np.max(max_x)), 'success'
            
    return 0, 'invalid_domain'

def defuzzify_continuous(params, method):
    m_type = params['type']
    p = params['params']
    domain = params['domain']
    
    try:
        from scipy.integrate import quad
        import scipy.optimize as opt
        
        def f(x_val): return _eval_membership(x_val, m_type, p)
        def xf(x_val): return x_val * _eval_membership(x_val, m_type, p)
        
        area, area_err, info, msg = quad(f, domain[0], domain[1], limit=100, full_output=1)
        
        if area == 0 and method in ['centroid', 'bisector']:
            return 0, 'zero_area', 'python_scipy', 'parametric'
            
        if method == 'centroid':
            moment, moment_err, info2, msg2 = quad(xf, domain[0], domain[1], limit=100, full_output=1)
            return moment / area, 'success', 'python_scipy', 'parametric'
            
        if method == 'bisector':
            def area_diff(x_val):
                left, _ = quad(f, domain[0], x_val, limit=50)
                return left - (area / 2.0)
            
            if area_diff(domain[0]) * area_diff(domain[1]) > 0:
                return 0, 'invalid_domain', 'python_scipy', 'parametric'
                
            root, res = opt.brentq(area_diff, domain[0], domain[1], full_output=True)
            if not res.converged:
                return 0, 'invalid_domain', 'python_scipy', 'parametric'
            return root, 'success', 'python_scipy', 'parametric'
            
    except Exception:
        pass
        
    # High resolution fallback if SciPy fails or for MOM/SOM/LOM
    x_vals = np.linspace(domain[0], domain[1], 10000)
    y_vals = np.array([_eval_membership(xv, m_type, p) for xv in x_vals])
    pts = np.column_stack((x_vals, y_vals))
    val, stat = defuzzify_discrete(pts, method)
    return val, stat, 'python_numpy', 'sampled'
