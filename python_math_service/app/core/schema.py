from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any, Union

PROTOCOL_VERSION = "1.0.0"

class MathAssumption(BaseModel):
    variable: str
    relation: str
    value: Any

class MathLimits(BaseModel):
    # Server-enforced clamping bounds
    timeout_ms: int = Field(default=5000, le=10000, description="Max execution time in ms")
    max_iterations: int = Field(default=1000, le=10000)
    max_matrix_dimension: int = Field(default=100, le=500)
    max_ast_depth: int = Field(default=50, le=100)
    max_ast_nodes: int = Field(default=1000, le=5000)

class PythonMathRequest(BaseModel):
    protocol_version: str = Field(default=PROTOCOL_VERSION)
    operation: Literal[
        "evaluate", "simplify", "solve_equation", "solve_inequality",
        "solve_ode", "derive", "integrate", "limit", "eigenvalues", "matrix_rref"
    ]
    # The Canonical AST dict. We use Dict[str, Any] but validate it recursively in the parser
    expression_ast: Dict[str, Any]
    
    variables: List[str] = Field(default_factory=list)
    evaluation_points: Optional[Dict[str, Any]] = None
    assumptions: List[MathAssumption] = Field(default_factory=list)
    limits: MathLimits = Field(default_factory=MathLimits)

class MathStep(BaseModel):
    id: str
    title: str
    explanation: str
    expression: Optional[str] = None
    latex: Optional[str] = None
    justification: Optional[str] = None

class PythonMathResponse(BaseModel):
    success: bool
    operation_performed: str
    # Return Canonical AST back to TypeScript
    result_ast: Optional[Dict[str, Any]] = None
    result_latex: Optional[str] = None
    computation_time_ms: float
    steps: List[MathStep] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    error_type: Optional[str] = None
