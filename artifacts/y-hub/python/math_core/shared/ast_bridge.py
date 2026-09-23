import sympy as sp
import re
import concurrent.futures

class ASTBridge:
    @staticmethod
    def bounded_simplify(expr, timeout=2.0):
        # Staged pipeline
        # 1. structural & cheap
        expr = sp.cancel(expr)  # combines rational fractions
        expr = sp.powsimp(expr)
        
        # 4. controlled function simplifications
        # Convert -I*erf(I*x) to erfi(x)
        # We can try to use rewrite(erfi) or manual subs if necessary.
        
        def run_heavy():
            # exact algebraic
            return sp.simplify(expr)
            
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(run_heavy)
                res = future.result(timeout=timeout)
                return res
        except (concurrent.futures.TimeoutError, Exception):
            return expr

    @staticmethod
    def format_erfi(sympy_expr):
        # SymPy represents erfi(x) as -I*erf(I*x). Let's convert it to a Function named 'erfi' for the AST
        # Actually, SymPy has sp.erfi.
        # But if it's currently expressed as erf(I*x), we rewrite.
        try:
            if sympy_expr.has(sp.erf):
                sympy_expr = sympy_expr.rewrite(sp.erfi)
        except:
            pass
        return sympy_expr

    @staticmethod
    def to_sympy(ast_node):
        if ast_node is None:
            return None
        t = ast_node.get('type')
        if t == 'Number':
            val = ast_node.get('value', '0')
            if '.' in val:
                return sp.Float(val)
            if '/' in val:
                n, d = val.split('/')
                return sp.Rational(int(n), int(d))
            return sp.Integer(val)
        elif t == 'Symbol':
            return sp.Symbol(ast_node.get('name'))
        elif t == 'IntegrationConstant':
            return sp.Symbol(ast_node.get('name', 'C1'))
        elif t == 'Constant':
            name = ast_node.get('name')
            if name == 'pi': return sp.pi
            if name == 'e': return sp.E
            if name == 'i': return sp.I
            return sp.Symbol(name)
        elif t == 'Operator':
            op = ast_node.get('operator')
            args = [ASTBridge.to_sympy(a) for a in ast_node.get('args', [])]
            if op == '+': return sum(args)
            elif op == '-': return -args[0] if len(args) == 1 else args[0] - args[1]
            elif op == '*':
                res = args[0]
                for a in args[1:]: res *= a
                return res
            elif op == '/': return args[0] / args[1]
            elif op == '^': return args[0] ** args[1]
        elif t == 'Function':
            name = ast_node.get('name')
            args = [ASTBridge.to_sympy(a) for a in ast_node.get('args', [])]
            if name == 'sin': return sp.sin(*args)
            if name == 'cos': return sp.cos(*args)
            if name == 'tan': return sp.tan(*args)
            if name == 'exp': return sp.exp(*args)
            if name == 'log': return sp.log(*args)
            if name == 'sqrt': return sp.sqrt(*args)
            if name == 'abs': return sp.Abs(*args)
            if name == 'erf': return sp.erf(*args)
            if name == 'erfi': return sp.erfi(*args)
            f = sp.Function(name)
            return f(*args)
        elif t == 'Equation':
            return sp.Eq(ASTBridge.to_sympy(ast_node.get('lhs')), ASTBridge.to_sympy(ast_node.get('rhs')))
        elif t == 'Derivative':
            expr = ASTBridge.to_sympy(ast_node.get('expression'))
            var = ASTBridge.to_sympy(ast_node.get('variable'))
            order = int(ast_node.get('order', 1))
            return sp.Derivative(expr, var, order)
                elif t == 'Limit':
            expr = ASTBridge.to_sympy(ast_node.get('expression'))
            var = ASTBridge.to_sympy(ast_node.get('variable'))
            target = ASTBridge.to_sympy(ast_node.get('target'))
            direction = ast_node.get('direction', '+')
            dir_sym = '+' if direction == '+' else '-' if direction == '-' else '+-'
            if dir_sym == '+-':
                return sp.Limit(expr, var, target, dir='+') # bidirectional approximation is complex in sympy
            return sp.Limit(expr, var, target, dir=dir_sym)
        elif t == 'Integral':
            expr = ASTBridge.to_sympy(ast_node.get('expression'))
            var = ASTBridge.to_sympy(ast_node.get('variable'))
            lower = ASTBridge.to_sympy(ast_node.get('lowerBound')) if 'lowerBound' in ast_node else None
            upper = ASTBridge.to_sympy(ast_node.get('upperBound')) if 'upperBound' in ast_node else None
            if lower is not None and upper is not None:
                return sp.Integral(expr, (var, lower, upper))
            return sp.Integral(expr, var)
        elif t == 'Matrix':
            rows = ast_node.get('rows', [])
            mat = [[ASTBridge.to_sympy(cell) for cell in row] for row in rows]
            return sp.Matrix(mat)
        
        raise ValueError('Unsupported AST node type: ' + str(t))

    @staticmethod
    def to_ast(sympy_expr, simplify=True):
        if simplify and not isinstance(sympy_expr, list) and not isinstance(sympy_expr, tuple) and not isinstance(sympy_expr, dict):
            sympy_expr = ASTBridge.bounded_simplify(sympy_expr)
            sympy_expr = ASTBridge.format_erfi(sympy_expr)

        if isinstance(sympy_expr, (int, sp.Integer)):
            return {'type': 'Number', 'value': str(sympy_expr)}
        if isinstance(sympy_expr, (float, sp.Float)):
            return {'type': 'Number', 'value': str(sympy_expr)}
        if isinstance(sympy_expr, sp.Rational):
            if sympy_expr.q == 1: return {'type': 'Number', 'value': str(sympy_expr.p)}
            return {'type': 'Number', 'value': str(sympy_expr.p) + '/' + str(sympy_expr.q)}
        
        if sympy_expr == sp.pi: return {'type': 'Constant', 'name': 'pi'}
        if sympy_expr == sp.E: return {'type': 'Constant', 'name': 'e'}
        if sympy_expr == sp.I: return {'type': 'Constant', 'name': 'i'}
        
        if isinstance(sympy_expr, sp.Symbol):
            name = sympy_expr.name
            if re.match(r'^C\d+$', name):
                return {'type': 'IntegrationConstant', 'name': name}
            return {'type': 'Symbol', 'name': name}
            
        if isinstance(sympy_expr, sp.Add):
            args = [ASTBridge.to_ast(a, simplify=False) for a in sympy_expr.args]
            return {'type': 'Operator', 'operator': '+', 'args': args}
        if isinstance(sympy_expr, sp.Mul):
            args = [ASTBridge.to_ast(a, simplify=False) for a in sympy_expr.args]
            return {'type': 'Operator', 'operator': '*', 'args': args}
        if isinstance(sympy_expr, sp.Pow):
            base = ASTBridge.to_ast(sympy_expr.args[0], simplify=False)
            exp = ASTBridge.to_ast(sympy_expr.args[1], simplify=False)
            # formatting: x^(1/2) -> sqrt(x)
            if exp.get('type') == 'Number' and exp.get('value') == '1/2':
                return {'type': 'Function', 'name': 'sqrt', 'args': [base]}
            return {'type': 'Operator', 'operator': '^', 'args': [base, exp]}
        if isinstance(sympy_expr, sp.Function):
            args = [ASTBridge.to_ast(a, simplify=False) for a in sympy_expr.args]
            name = sympy_expr.func.__name__
            return {'type': 'Function', 'name': name, 'args': args}
        if isinstance(sympy_expr, sp.Derivative):
            return {
                'type': 'Derivative',
                'expression': ASTBridge.to_ast(sympy_expr.expr, simplify=False),
                'variable': ASTBridge.to_ast(sympy_expr.variables[0], simplify=False),
                'order': len(sympy_expr.variables)
            }
                if isinstance(sympy_expr, sp.Limit):
            return {
                'type': 'Limit',
                'expression': ASTBridge.to_ast(sympy_expr.args[0], simplify=False),
                'variable': ASTBridge.to_ast(sympy_expr.args[1], simplify=False),
                'target': ASTBridge.to_ast(sympy_expr.args[2], simplify=False),
                'direction': sympy_expr.args[3] if len(sympy_expr.args) > 3 else '+'
            }
        if isinstance(sympy_expr, sp.Integral):
            var = sympy_expr.limits[0][0]
            if len(sympy_expr.limits[0]) == 3:
                return {
                    'type': 'Integral',
                    'expression': ASTBridge.to_ast(sympy_expr.function, simplify=False),
                    'variable': ASTBridge.to_ast(var, simplify=False),
                    'lowerBound': ASTBridge.to_ast(sympy_expr.limits[0][1], simplify=False),
                    'upperBound': ASTBridge.to_ast(sympy_expr.limits[0][2], simplify=False)
                }
            return {
                'type': 'Integral',
                'expression': ASTBridge.to_ast(sympy_expr.function, simplify=False),
                'variable': ASTBridge.to_ast(var, simplify=False)
            }
        if isinstance(sympy_expr, sp.Eq):
            return {
                'type': 'Equation',
                'lhs': ASTBridge.to_ast(sympy_expr.lhs, simplify=False),
                'rhs': ASTBridge.to_ast(sympy_expr.rhs, simplify=False)
            }
        if hasattr(sympy_expr, 'is_Matrix') and sympy_expr.is_Matrix:
            rows = []
            for i in range(sympy_expr.rows):
                row = []
                for j in range(sympy_expr.cols):
                    row.append(ASTBridge.to_ast(sympy_expr[i, j], simplify=False))
                rows.append(row)
            return {'type': 'Matrix', 'rows': rows}
        if isinstance(sympy_expr, list) or isinstance(sympy_expr, tuple):
            return [ASTBridge.to_ast(item, simplify=simplify) for item in sympy_expr]
            
        return {'type': 'Symbol', 'name': str(sympy_expr)}

