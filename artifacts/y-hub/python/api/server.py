from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator
from typing import List, Dict, Any, Optional
import sympy as sp
import numpy as np

# Internal imports
from math_core.linear_algebra.engine import handle_linear_algebra
from math_core.ode.engine import handle_ode
from math_core.calculus.engine import handle_calculus
from math_core.fuzzy.engine import handle_fuzzy

app = FastAPI()

@app.get('/api/v1/math/health')
def health_check():
    import sys
    status = {
        'status': 'ok',
        'python': True,
        'python_version': sys.version,
        'sympy': False,
        'numpy': False,
        'scipy': False,
        'symbolic_test': False
    }
    try:
        import sympy as sp
        status['sympy'] = True
        x = sp.Symbol('x')
        if sp.diff(x**2, x) == 2*x:
            status['symbolic_test'] = True
    except ImportError:
        pass
        
    try:
        import numpy as np
        status['numpy'] = True
    except ImportError:
        pass
        
    try:
        import scipy
        status['scipy'] = True
    except ImportError:
        pass
        
    return status

class MathRequest(BaseModel):
    operation: str
    phase: str
    mode: str
    input: Any
    assumptions: Optional[Dict[str, Any]] = None

def _json_safe_math_result(value):
    """Convert mathematical values into JSON-compatible data."""
    if isinstance(value, sp.Integer):
        return int(value)
    if isinstance(value, sp.Rational):
        return str(value)
    if isinstance(value, sp.Float):
        return float(value)
    if isinstance(value, sp.MatrixBase):
        return _json_safe_math_result(value.tolist())
    if isinstance(value, sp.Basic):
        return str(value)
    if isinstance(value, np.ndarray):
        return _json_safe_math_result(value.tolist())
    if isinstance(value, np.generic):
        return _json_safe_math_result(value.item())
    if isinstance(value, dict):
        return {
            str(k): _json_safe_math_result(v)
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_json_safe_math_result(v) for v in value]
    return value


class MathResponse(BaseModel):
    operation: str
    phase: str
    mode: str
    input: Any
    normalized_input: Any
    result: Any
    steps: List[Any]
    assumptions: Optional[Dict[str, Any]]
    conditions: List[Any]
    domain: Any
    verification: Any
    verification_status: str
    exactness: str
    numerical_evidence: Any
    warnings: List[str]
    errors: List[str]
    status: str
    classification: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_contract(cls, values):
        if not isinstance(values, dict):
            return values

        data = dict(values)
        data["result"] = _json_safe_math_result(
            data.get("result")
        )

        if "status" not in data:
            result = data["result"]
            nested = (
                result.get("status")
                if isinstance(result, dict) else None
            )

            failure_states = {
                "invalid_domain",
                "outside_domain",
                "zero_area",
                "invalid_configuration",
                "verification_failed",
                "unsupported",
            }

            if data.get("errors"):
                status = "invalid_input"
            elif data.get("operation") == "fuzzy_inference":
                status = "unsupported"
            elif nested in failure_states:
                status = nested
            elif result is None:
                status = "no_solution"
            else:
                status = "solved"

            data["status"] = status

        return data


@app.post('/api/v1/math/compute', response_model=MathResponse)
def compute(req: MathRequest):
    try:
        if req.phase == '10':
            return handle_linear_algebra(req)
        elif req.phase in ['7', '8', '9']:
            return handle_ode(req)
        elif req.phase == '6':
            return handle_calculus(req)
        elif req.phase == 'fuzzy':
            return handle_fuzzy(req)
        else:
            raise HTTPException(status_code=400, detail='Unsupported phase')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail='Internal math computation error'
        ) from e

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)



