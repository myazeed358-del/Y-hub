import sympy as sp
import time
from app.core.schema import PythonMathRequest, PythonMathResponse, MathStep
from app.services.ast_parser import CanonicalASTParser, SecurityViolationError

class MathSolverService:
    def process(self, request: PythonMathRequest) -> PythonMathResponse:
        start_time = time.time()
        warnings = []
        steps = []
        
        try:
            # 1. Parse AST safely
            parser = CanonicalASTParser(request.limits)
            sympy_expr = parser.to_sympy(request.expression_ast)
            
            # 2. Build assumptions
            # SymPy handles assumptions usually during Symbol creation, 
            # e.g., sp.Symbol('x', positive=True).
            # We would map request.assumptions here in a complete implementation.
            
            # 3. Route Operation
            result_expr = None
            op = request.operation
            
            # We use a controlled whitelist switch
            if op == "evaluate" or op == "simplify":
                result_expr = sp.simplify(sympy_expr)
                
            elif op == "derive":
                var_str = request.variables[0] if request.variables else "x"
                var = sp.Symbol(var_str)
                result_expr = sp.diff(sympy_expr, var)
                
            elif op == "integrate":
                var_str = request.variables[0] if request.variables else "x"
                var = sp.Symbol(var_str)
                # Integration with bounded time would require a thread/timeout wrap,
                # but for Step E structure we map directly to sympy.integrate
                result_expr = sp.integrate(sympy_expr, var)
                
            elif op == "limit":
                var_str = request.variables[0] if request.variables else "x"
                var = sp.Symbol(var_str)
                # Assuming evaluation_points {"x": 0}
                point_ast = request.evaluation_points.get(var_str, {"type": "Number", "value": "0"})
                point_val = parser.to_sympy(point_ast)
                result_expr = sp.limit(sympy_expr, var, point_val)
                
            elif op == "solve_equation":
                if isinstance(sympy_expr, sp.Equality):
                    # Move everything to LHS
                    eq = sympy_expr.lhs - sympy_expr.rhs
                else:
                    eq = sympy_expr
                var_str = request.variables[0] if request.variables else "x"
                var = sp.Symbol(var_str)
                solutions = sp.solve(eq, var, dict=True)
                # Result structure for multiple solutions would need a list or Set node.
                # Here we mock mapping the first solution or return a list
                if not solutions:
                    raise ValueError("No solutions found or equation is invalid.")
                # Just return the first for structural demo
                result_expr = solutions[0][var]

            else:
                raise ValueError(f"Operation {op} is currently not supported by the Python adapter.")

            # 4. Format Result
            latex_res = sp.latex(result_expr)
            result_ast = parser.to_canonical(result_expr)

            return PythonMathResponse(
                success=True,
                operation_performed=op,
                result_ast=result_ast,
                result_latex=latex_res,
                computation_time_ms=(time.time() - start_time) * 1000,
                steps=steps,
                warnings=warnings
            )

        except SecurityViolationError as e:
            return PythonMathResponse(
                success=False,
                operation_performed=request.operation,
                computation_time_ms=(time.time() - start_time) * 1000,
                error=str(e),
                error_type="security_violation"
            )
        except Exception as e:
            return PythonMathResponse(
                success=False,
                operation_performed=request.operation,
                computation_time_ms=(time.time() - start_time) * 1000,
                error=str(e),
                error_type="internal_error"
            )
