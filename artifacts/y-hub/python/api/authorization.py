"""HTTP access boundary. Supabase verifies JWT and current DB grants on EVERY call.
No cached role claims, service key, offline bypass, or mathematical dependencies.
"""
import json,os,urllib.request,urllib.error
from fastapi import HTTPException,Request

def verify_compute(token:str,protocol:str,scope:str):
    if not token.startswith('Bearer ') or not token[7:].strip():
        raise HTTPException(401,'Authentication required')
    url=os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL','')
    key=os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('VITE_SUPABASE_ANON_KEY','')
    if not url.startswith('https://') or not key:
        raise HTTPException(503,'Engine authorization is not configured')
    payload=json.dumps({'p_protocol':protocol,'p_scope':scope}).encode()
    req=urllib.request.Request(url.rstrip('/')+'/rest/v1/rpc/authorize_engine_compute',data=payload,
        headers={'Content-Type':'application/json','apikey':key,'Authorization':token},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=8) as response:allowed=json.loads(response.read(1024))
    except urllib.error.HTTPError as e:
        raise HTTPException(401 if e.code==401 else 403 if e.code==403 else 503,'Engine authorization failed') from None
    except (OSError,ValueError):raise HTTPException(503,'Engine authorization unavailable') from None
    if allowed is not True:raise HTTPException(403,'Engine access denied')

async def require_phase_access(request:Request):
    from starlette.concurrency import run_in_threadpool
    try:payload=await request.json()
    except ValueError:raise HTTPException(422,'Invalid JSON') from None
    if not isinstance(payload,dict):raise HTTPException(422,'Invalid request')
    await run_in_threadpool(verify_compute,request.headers.get('authorization',''),'phase',str(payload.get('phase','')))

async def require_ast_access(request:Request):
    from starlette.concurrency import run_in_threadpool
    try:payload=await request.json()
    except ValueError:raise HTTPException(422,'Invalid JSON') from None
    if not isinstance(payload,dict):raise HTTPException(422,'Invalid request')
    await run_in_threadpool(verify_compute,request.headers.get('authorization',''),'ast',str(payload.get('operation','')))
