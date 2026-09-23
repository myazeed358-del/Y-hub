from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
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
    except Exception as e:
        return MathResponse(
            operation=req.operation,
            phase=req.phase,
            mode=req.mode,
            input=req.input,
            normalized_input=None,
            result=None,
            steps=[],
            assumptions=req.assumptions,
            conditions=[],
            domain=None,
            verification=None,
            verification_status='verification_failed',
            exactness='exact_symbolic',
            numerical_evidence=None,
            warnings=[],
            errors=[str(e)]
        )

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)



