"""Local disposable PostgreSQL only. No connection string or remote target accepted."""
import os, subprocess, uuid
C=os.environ['YHUB_ACADEMIC_TEST_CONTAINER']; assert C.startswith('yhub-academic-test-')
BASE=['docker','--host=unix:///var/run/docker.sock','exec','-i',C,'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
I,A,S,U,O=[f'00000000-0000-0000-0000-00000000000{n}' for n in [1,2,3,4,5]]
def run(sql,actor=None,check=True):
 prefix=f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{actor}';" if actor else ''
 p=subprocess.run(BASE,input='BEGIN;'+prefix+sql+';COMMIT;',capture_output=True,text=True,timeout=25)
 if check and p.returncode: raise AssertionError(p.stderr)
 return p
def value(sql,actor=None):return run(sql,actor).stdout.strip()
def definition(major='mathematics'):
 id=str(uuid.uuid4());run(f"INSERT INTO public.course_definitions(id,code,title,academic_major) VALUES('{id}','MATH101','Calculus','{major}')",A);return id
def course(owner=I,definition_id=None):
 id=str(uuid.uuid4());extra=f",'{definition_id}'" if definition_id else ''
 column=',course_definition_id' if definition_id else ''
 run(f"INSERT INTO public.courses(id,instructor_id,title,course_code,is_published,enrollment_open{column}) VALUES('{id}','{owner}','Same title','SAME',true,true{extra})",owner)
 return id
