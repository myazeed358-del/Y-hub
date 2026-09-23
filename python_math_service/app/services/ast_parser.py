import sympy as sp
from typing import Dict, Any

class SecurityViolationError(Exception):
    pass

class CanonicalASTParser:
    def __init__(self, limits):
        self.limits = limits
        self.node_count = 0

    def to_sympy(self, ast: Dict[str, Any], depth: int = 0) -> sp.Expr:
        """
        Recursively converts Y HUB Canonical AST to SymPy expressions.
        ABSOLUTELY NO EVAL() USED HERE.
        """
        self.node_count += 1
        
        if depth > self.limits.max_ast_depth:
            raise SecurityViolationError("Maximum AST depth exceeded.")
        if self.node_count > self.limits.max_ast_nodes:
            raise SecurityViolationError("Maximum AST node count exceeded.")

        t = ast.get("type")
        if not t:
            raise ValueError("AST node missing 'type' field.")

        if t == "Number":
            # Safely parse numeric string via sympify (which is safe for pure numbers)
            val = ast.get("value", "0")
            return sp.sympify(val)
        
        if t == "Symbol":
            return sp.Symbol(ast.get("name", "x"))
            
        if t == "Constant":
            name = ast.get("name")
            if name == "pi": return sp.pi
            if name == "e": return sp.E
            if name == "i": return sp.I
            raise ValueError(f"Unknown constant: {name}")

        if t == "Operator":
            op = ast.get("operator")
            args = [self.to_sympy(a, depth + 1) for a in ast.get("args", [])]
            if op == "+": return sum(args)
            if op == "-":
                if len(args) == 1: return -args[0]
                return args[0] - sum(args[1:])
            if op == "*" or op == "implicit_multiply":
                return sp.Mul(*args)
            if op == "/":
                return args[0] / args[1]
            if op == "^":
                return args[0] ** args[1]
            raise ValueError(f"Unknown operator: {op}")

        if t == "Function":
            name = ast.get("name")
            args = [self.to_sympy(a, depth + 1) for a in ast.get("args", [])]
            
            # Map canonical names to SymPy functions
            fn_map = {
                "sin": sp.sin, "cos": sp.cos, "tan": sp.tan,
                "asin": sp.asin, "acos": sp.acos, "atan": sp.atan,
                "log": sp.log, "exp": sp.exp, "sqrt": sp.sqrt,
                "abs": sp.Abs
            }
            if name in fn_map:
                return fn_map[name](*args)
            raise ValueError(f"Unknown function: {name}")

        if t == "Parenthesis":
            return self.to_sympy(ast.get("content", {}), depth + 1)

        if t == "Equation":
            lhs = self.to_sympy(ast.get("lhs", {}), depth + 1)
            rhs = self.to_sympy(ast.get("rhs", {}), depth + 1)
            return sp.Eq(lhs, rhs)

        raise ValueError(f"Unsupported AST node type: {t}")

    def to_canonical(self, expr: sp.Expr) -> Dict[str, Any]:
        """
        Converts SymPy expressions back into Y HUB Canonical AST.
        """
        if isinstance(expr, sp.Number):
            return {"type": "Number", "value": str(expr)}
        if isinstance(expr, sp.Symbol):
            return {"type": "Symbol", "name": str(expr)}
        if expr == sp.pi: return {"type": "Constant", "name": "pi"}
        if expr == sp.E: return {"type": "Constant", "name": "e"}
        if expr == sp.I: return {"type": "Constant", "name": "i"}

        if isinstance(expr, sp.Add):
            return {"type": "Operator", "operator": "+", "args": [self.to_canonical(a) for a in expr.args]}
        if isinstance(expr, sp.Mul):
            return {"type": "Operator", "operator": "*", "args": [self.to_canonical(a) for a in expr.args]}
        if isinstance(expr, sp.Pow):
            return {"type": "Operator", "operator": "^", "args": [self.to_canonical(expr.base), self.to_canonical(expr.exp)]}
        
        # Functions
        if isinstance(expr, sp.sin): return {"type": "Function", "name": "sin", "args": [self.to_canonical(expr.args[0])]}
        if isinstance(expr, sp.cos): return {"type": "Function", "name": "cos", "args": [self.to_canonical(expr.args[0])]}
        if isinstance(expr, sp.log): return {"type": "Function", "name": "log", "args": [self.to_canonical(expr.args[0])]}
        if isinstance(expr, sp.exp): return {"type": "Function", "name": "exp", "args": [self.to_canonical(expr.args[0])]}

        if isinstance(expr, sp.Equality):
            return {"type": "Equation", "lhs": self.to_canonical(expr.lhs), "rhs": self.to_canonical(expr.rhs)}

        # Fallback for complex unsupported structures in step E (temporarily stringified)
        return {"type": "Symbol", "name": str(expr)}
