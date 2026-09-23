import sympy as sp
import numpy as np
from math_core.shared.ast_bridge import ASTBridge

def extract_singularities(expr, var):
    try:
        from sympy.calculus.singularities import singularities
        sings = singularities(expr, var)
        if hasattr(sings, '__iter__') and not isinstance(sings, sp.ConditionSet):
            return [ASTBridge.to_ast(s) for s in sings if s.is_real]
    except Exception:
        pass
    return []

def handle_calculus(req):
    op = req.operation
    mode = req.mode
    data = req.input
    
    warnings = []
    errors = []
    steps = []
    conditions = []
    result = None
    exactness = 'exact_symbolic'
    classification = 'UNKNOWN'
    
    try:
        expr_ast = data.get('expression')
        var_ast = data.get('variable')
        
        expr = ASTBridge.to_sympy(expr_ast)
        var = ASTBridge.to_sympy(var_ast)
        
        # Extract initial domain restrictions
        sings = extract_singularities(expr, var)
        if sings:
            for s in sings:
                conditions.append({
                    'type': 'DomainRestriction',
                    'variable': data.get('variable'),
                    'excludedValue': s
                })
        
        if op == 'integrate':
            if mode == 'exact' or mode == 'auto':
                if 'lowerBound' in data and 'upperBound' in data:
                    lower = ASTBridge.to_sympy(data['lowerBound'])
                    upper = ASTBridge.to_sympy(data['upperBound'])
                    
                    # Definite / Improper (6G, 6H)
                    res_expr = sp.integrate(expr, (var, lower, upper))
                    
                    if res_expr.has(sp.oo, -sp.oo, sp.zoo, sp.nan):
                        classification = 'divergent'
                        result = None
                        steps.append({'description': 'Integral diverges', 'result': None})
                    else:
                        # Could be Principal Value if piecewise, SymPy integrates directly
                        classification = 'convergent'
                        result = ASTBridge.to_ast(res_expr)
                        steps.append({'description': 'Computed exact definite integral via SymPy', 'result': result})
                else:
                    # Indefinite
                    classification = 'symbolic_indefinite'
                    res_expr = sp.integrate(expr, var)
                    result = ASTBridge.to_ast(res_expr)
                    steps.append({'description': 'Computed exact indefinite integral via SymPy', 'result': result})
                    
                    # Verification
                    diff_back = sp.diff(res_expr, var)
                    residual = sp.simplify(diff_back - expr)
                    if residual == 0:
                        verification_status = 'exactly_equivalent'
                    else:
                        verification_status = 'not_proven'
                        
            elif mode == 'numerical':
                exactness = 'numerical_approximation'
                lower = float(ASTBridge.to_sympy(data['lowerBound']))
                upper = float(ASTBridge.to_sympy(data['upperBound']))
                
                from scipy.integrate import quad
                import warnings as scipy_warnings
                f_lam = sp.lambdify(var, expr, 'numpy')
                
                with scipy_warnings.catch_warnings(record=True) as w:
                    val, err = quad(f_lam, lower, upper)
                    if len(w) > 0:
                        warnings.append(str(w[-1].message))
                        classification = 'numerical_warning'
                    else:
                        classification = 'numerical_convergent'
                        
                result = {'type': 'Number', 'value': str(val)}
                steps.append({'description': 'Computed numerical integration', 'error_estimate': err})
        
        elif op == 'differentiate':
            if mode == 'exact' or mode == 'auto':
                res_expr = sp.diff(expr, var)
                result = ASTBridge.to_ast(res_expr)
                steps.append({'description': 'Computed exact derivative via SymPy', 'result': result})
                
    except Exception as e:
        errors.append(str(e))
        
    status = 'solved' if not errors and result is not None else ('no_solution' if result is None else 'invalid_input')
    
    return {
        'operation': op,
        'phase': '6',
        'mode': mode,
        'input': data,
        'normalized_input': data,
        'result': result,
        'steps': steps,
        'classification': classification,
        'assumptions': None,
        'conditions': conditions,
        'domain': None,
        'verification': None,
        'verification_status': 'verification_failed' if errors else locals().get('verification_status', 'not_proven'),
        'exactness': exactness,
        'numerical_evidence': None,
        'warnings': warnings,
        'errors': errors
    }
