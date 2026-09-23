from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.schema import PythonMathRequest, PythonMathResponse, PROTOCOL_VERSION
from app.services.solver import MathSolverService
import uvicorn

app = FastAPI(title="Y HUB Python Math Backend", version=PROTOCOL_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

solver_service = MathSolverService()

@app.post("/api/v1/math/compute", response_model=PythonMathResponse)
async def compute_math(request: PythonMathRequest):
    if request.protocol_version != PROTOCOL_VERSION:
        raise HTTPException(
            status_code=400, 
            detail=f"Protocol version mismatch. Server requires {PROTOCOL_VERSION}"
        )
    
    # In a production setup with timeout support, we would use asyncio.wait_for
    # or a process pool to enforce the `request.limits.timeout_ms` strictly.
    response = solver_service.process(request)
    
    if not response.success:
        # We still return 200 OK but with the error payload structured
        # unless it's a critical HTTP-level failure
        pass
        
    return response

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
