import sympy as sp
import numpy as np
from math_core.shared.ast_bridge import ASTBridge

def find_equilibrium_solutions(eq, f, y_sym):
    try:
        c = sp.Symbol('c', real=True)
        residual = eq.lhs - eq.rhs
        
        def replace_const(expr):
            if isinstance(expr, sp.Derivative) and expr.expr == y_sym:
                return sp.Integer(0)
            elif expr == y_sym:
                return c
            if hasattr(expr, 'args'):
                return expr.func(*[replace_const(a) for a in expr.args])
            return expr
            
        eq_c = replace_const(residual)
        roots = sp.solve(eq_c, c)
        return roots
    except Exception:
        return []

def handle_ode(req):
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
        if mode == 'exact' or mode == 'auto':
            if op == 'solve_ode':
                eq_ast = data.get('equation')
                indep_ast = data.get('independentVariable')
                dep_ast = data.get('dependentVariable')
                
                eq = ASTBridge.to_sympy(eq_ast)
                indep = ASTBridge.to_sympy(indep_ast)
                dep_name = dep_ast.get('name') if isinstance(dep_ast, dict) else dep_ast
                
                f = sp.Function(dep_name)(indep)
                y_sym = sp.Symbol(dep_name)
                
                def replace_func(expr):
                    if isinstance(expr, sp.Derivative):
                        if expr.expr == y_sym:
                            return sp.Derivative(f, indep, len(expr.variables))
                    elif expr == y_sym:
                        return f
                    if hasattr(expr, 'args'):
                        return expr.func(*[replace_func(a) for a in expr.args])
                    return expr
                    
                eq_f = sp.Eq(replace_func(eq.lhs), replace_func(eq.rhs))
                
                equilibriums = find_equilibrium_solutions(eq, f, y_sym)
                
                hints = sp.classify_ode(eq_f, f)
                best_hint = hints[0] if hints else 'default'
                classification = 'EXACT_SYMBOLIC_ODE_' + best_hint.upper()
                
                                ics_dict = {}
                if 'initialConditions' in data:
                    for ic in data['initialConditions']:
                        # Example: y(0) = 1 -> f(0): 1, y'(0) = 2 -> f(indep).diff(indep).subs(indep, 0): 2
                        # To keep it simple, we assume the frontend passes ASTs like 'f(0)' and '1'
                        # Or standard representations. We'll evaluate them.
                        ic_lhs = ASTBridge.to_sympy(ic.get('lhs'))
                        ic_rhs = ASTBridge.to_sympy(ic.get('rhs'))
                        if ic_lhs is not None and ic_rhs is not None:
                            # Replace y(x) evaluation with f(val)
                            def replace_ic(expr):
                                if hasattr(expr, 'func') and expr.func == y_sym:
                                    return f.subs(indep, expr.args[0])
                                if hasattr(expr, 'args'):
                                    return expr.func(*[replace_ic(a) for a in expr.args])
                                return expr
                            ic_lhs = replace_ic(ic_lhs)
                            ics_dict[ic_lhs] = ic_rhs
                
                sol = sp.dsolve(eq_f, f, ics=ics_dict) if ics_dict else sp.dsolve(eq_f, f)
                
                res_list = []
                if isinstance(sol, list):
                    for s in sol:
                        res_list.append(ASTBridge.to_ast(s.rhs))
                else:
                    res_list.append(ASTBridge.to_ast(sol.rhs))
                    
                for root in equilibriums:
                    conditions.append({
                        'type': 'EquilibriumSolution',
                        'variable': dep_name,
                        'value': ASTBridge.to_ast(root)
                    })
                    
                result = res_list
                steps.append({'description': f'Solved ODE exactly via SymPy using {best_hint}'})
                
                verification_status = 'not_proven'
                try:
                    sol_list = sol if isinstance(sol, list) else [sol]
                    all_verified = True
                    for s in sol_list:
                        res = sp.simplify(eq_f.lhs.subs(f, s.rhs).doit() - eq_f.rhs.subs(f, s.rhs).doit())
                        if res != 0:
                            all_verified = False
                    if all_verified:
                        verification_status = 'exactly_equivalent'
                except Exception:
                    pass
                
            elif op == 'solve_system_ode':
                eqs_ast = data.get('equations')
                indep_ast = data.get('independentVariable')
                deps_ast = data.get('dependentVariables')
                
                eqs = [ASTBridge.to_sympy(e) for e in eqs_ast]
                indep = ASTBridge.to_sympy(indep_ast)
                
                funcs = []
                subs_map = {}
                for dep in deps_ast:
                    name = dep.get('name') if isinstance(dep, dict) else dep
                    sym = sp.Symbol(name)
                    func = sp.Function(name)(indep)
                    funcs.append(func)
                    subs_map[sym] = func
                    
                def replace_funcs(expr):
                    if isinstance(expr, sp.Derivative):
                        if expr.expr in subs_map:
                            return sp.Derivative(subs_map[expr.expr], indep, len(expr.variables))
                    elif expr in subs_map:
                        return subs_map[expr]
                    if hasattr(expr, 'args'):
                        return expr.func(*[replace_funcs(a) for a in expr.args])
                    return expr
                    
                eqs_f = [sp.Eq(replace_funcs(eq.lhs), replace_funcs(eq.rhs)) for eq in eqs]
                
                                ics_dict = {}
                if 'initialConditions' in data:
                    for ic in data['initialConditions']:
                        ic_lhs = ASTBridge.to_sympy(ic.get('lhs'))
                        ic_rhs = ASTBridge.to_sympy(ic.get('rhs'))
                        if ic_lhs is not None and ic_rhs is not None:
                            def replace_ic_sys(expr):
                                if hasattr(expr, 'func') and expr.func in subs_map.keys():
                                    return subs_map[expr.func].subs(indep, expr.args[0])
                                if hasattr(expr, 'args'):
                                    return expr.func(*[replace_ic_sys(a) for a in expr.args])
                                return expr
                            ic_lhs = replace_ic_sys(ic_lhs)
                            ics_dict[ic_lhs] = ic_rhs
                
                sol = sp.dsolve(eqs_f, funcs, ics=ics_dict) if ics_dict else sp.dsolve(eqs_f, funcs)
                
                res_list = []
                for func in funcs:
                    if isinstance(sol, list):
                        pass
                    elif isinstance(sol, dict):
                        if func in sol:
                            res_list.append(ASTBridge.to_ast(sol[func]))
                    else:
                        if isinstance(sol, set) or isinstance(sol, tuple):
                            for s in sol:
                                if isinstance(s, sp.Eq) and s.lhs == func:
                                    res_list.append(ASTBridge.to_ast(s.rhs))
                
                if not res_list and isinstance(sol, list):
                    for s in sol:
                        if isinstance(s, sp.Eq):
                            res_list.append(ASTBridge.to_ast(s.rhs))
                            
                result = res_list
                classification = 'SYSTEM_ODE_EXACT'
                steps.append({'description': 'Solved system exactly via SymPy dsolve'})
                
        if mode == 'numerical' or op == 'phase_plane':
            exactness = 'numerical_approximation'
            
            if op == 'phase_plane':
                # Build meshgrid of vector fields and nullclines for an autonomous system
                bounds = data.get('bounds', {'x_min': -10, 'x_max': 10, 'y_min': -10, 'y_max': 10})
                eq1_ast = data.get('eq1')
                eq2_ast = data.get('eq2')
                x_var = sp.Symbol(data.get('x_var', 'x'))
                y_var = sp.Symbol(data.get('y_var', 'y'))
                
                eq1 = ASTBridge.to_sympy(eq1_ast)
                eq2 = ASTBridge.to_sympy(eq2_ast)
                
                f1 = sp.lambdify((x_var, y_var), eq1, 'numpy')
                f2 = sp.lambdify((x_var, y_var), eq2, 'numpy')
                
                x_vals = np.linspace(bounds['x_min'], bounds['x_max'], 20)
                y_vals = np.linspace(bounds['y_min'], bounds['y_max'], 20)
                
                X, Y = np.meshgrid(x_vals, y_vals)
                U = f1(X, Y)
                V = f2(X, Y)
                
                result = {
                    'x_grid': X.tolist(),
                    'y_grid': Y.tolist(),
                    'u_grid': U.tolist(),
                    'v_grid': V.tolist(),
                    'nullcline_1': ASTBridge.to_ast(eq1),
                    'nullcline_2': ASTBridge.to_ast(eq2)
                }
                classification = 'PHASE_PLANE_DATA'
                steps.append({'description': 'Computed phase plane vector field over grid bounds'})
                
    except Exception as e:
        errors.append(str(e))
        
    status = 'solved' if not errors and result is not None else ('no_solution' if result is None else 'invalid_input')
    
    return {
        'operation': op,
        'phase': req.phase,
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
        'verification_status': locals().get('verification_status', 'verification_failed' if errors else 'not_proven'),
        'exactness': exactness,
        'numerical_evidence': None,
        'warnings': warnings,
        'errors': errors
    }

