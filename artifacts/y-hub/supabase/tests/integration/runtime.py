"""Disposable GoTrue/PostgREST/PostgreSQL; local Docker only, no remote DB URL."""
import http.client, json, os, secrets, subprocess, time, uuid
from pathlib import Path

DOCKER=['docker','--host=unix:///var/run/docker.sock']
IMAGES={'db':'postgres:16-alpine','auth':'supabase/gotrue:v2.177.0','rest':'postgrest/postgrest:v12.2.3'}
class Stack:
 def __init__(self,root):
  self.root=Path(root);self.name='yhub-jwt-test-'+uuid.uuid4().hex[:10];self.secret=secrets.token_urlsafe(40)
  self.names={key:self.name+'-'+key for key in IMAGES};self.started=[];self.network=False
 def docker(self,*args,input=None):
  env={k:v for k,v in os.environ.items() if k not in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']}
  p=subprocess.run(DOCKER+list(args),input=input,capture_output=True,text=True,timeout=120,env=env)
  if p.returncode:raise RuntimeError('Local Docker operation failed: '+p.stderr[-1800:])
  return p.stdout.strip()
 def sql(self,sql):
  return self.docker('exec','-i',self.names['db'],'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1',input='SET search_path=public;'+sql)
 def request(self,service,path,data=None,token=None,method=None,profile=None):
  assert service in ('auth','rest')
  assert path.startswith('/') and '\r' not in path and '\n' not in path
  if profile is not None:assert profile.replace('_','').isalnum()
  body=json.dumps(data).encode() if data is not None else b''
  headers=f'Authorization: Bearer {token}\r\n' if token else ''
  if profile is not None:headers+=f'Accept-Profile: {profile}\r\n'
  req=(f'{method or ("POST" if data is not None else "GET")} {path} HTTP/1.1\r\nHost: local\r\nConnection: close\r\nContent-Type: application/json\r\nPrefer: return=representation\r\n{headers}Content-Length: {len(body)}\r\n\r\n').encode()+body
  # HTTP stays on the isolated Docker network; no published ports or proxy bypass.
  # Keep stdin open until the response completes: early EOF cancels GoTrue requests.
  p=subprocess.Popen(DOCKER+['exec','-i',self.names['db'],'nc','-w','15',self.names[service],str(9999 if service=='auth' else 3000)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
   p.stdin.write(req);p.stdin.flush()
   class Socket:
    def makefile(self,*_):return p.stdout
   response=http.client.HTTPResponse(Socket());response.begin();raw=response.read()
   return response.status,json.loads(raw) if raw else None
  finally:
   p.stdin.close()
   try:p.wait(timeout=20)
   except subprocess.TimeoutExpired:p.kill();p.wait()
   finally:p.stdout.close();p.stderr.close()
 def start(self):
  for image in IMAGES.values():self.docker('image','inspect',image)
  self.docker('network','create','--internal',self.name);self.network=True
  self.run('db',['POSTGRES_HOST_AUTH_METHOD=trust'])
  for _ in range(80):
   try:self.sql('SELECT 1');break
   except RuntimeError:time.sleep(.25)
  else:raise RuntimeError('Local PostgreSQL unavailable')
  self.sql('CREATE SCHEMA auth; ALTER ROLE postgres SET search_path=auth,public;')
  self.run('auth',['GOTRUE_API_HOST=0.0.0.0','GOTRUE_API_PORT=9999','API_EXTERNAL_URL=http://localhost:9999','GOTRUE_SITE_URL=http://localhost:3000','GOTRUE_DB_DRIVER=postgres',f'GOTRUE_DB_DATABASE_URL=postgres://postgres@{self.names["db"]}:5432/postgres?sslmode=disable','GOTRUE_JWT_SECRET='+self.secret,'GOTRUE_JWT_EXP=3600','GOTRUE_JWT_AUD=authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated','GOTRUE_DISABLE_SIGNUP=false','GOTRUE_MAILER_AUTOCONFIRM=true'])
  self.wait('auth','/health')
  self.sql((Path(__file__).parent/'bootstrap.sql').read_text())
  for migration in sorted((self.root/'artifacts/y-hub/supabase/migrations').glob('*.sql')):self.sql(migration.read_text())
  # Reviewed source manifests are deployment metadata; local-only synchronization.
  if self.sql("SELECT to_regclass('public.module_policies') IS NOT NULL")=='t':
   metadata=subprocess.check_output(['node','tools/export_module_policy.mjs'],cwd=self.root,text=True)
   self.sql(metadata)
  self.run('rest',[f'PGRST_DB_URI=postgresql://authenticator@{self.names["db"]}:5432/postgres','PGRST_DB_SCHEMAS=public','PGRST_DB_ANON_ROLE=anon','PGRST_JWT_SECRET='+self.secret])
  self.wait('rest','/')
 def run(self,kind,variables):
  args=['run','-d','--name',self.names[kind],'--network',self.name]
  for variable in variables:args+=['-e',variable]
  self.docker(*args,IMAGES[kind]);self.started.append(kind)
 def wait(self,service,path):
  for _ in range(80):
   try:
    status,_=self.request(service,path)
    if status==200:return
   except (OSError,http.client.HTTPException,ValueError):pass
   time.sleep(.25)
  raise RuntimeError('Local service did not become ready: '+service)
 def close(self):
  for kind in reversed(self.started):self.docker('rm','-f',self.names[kind])
  if self.network:self.docker('network','rm',self.name)
