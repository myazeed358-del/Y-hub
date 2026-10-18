"""Real isolated PostgreSQL, using disposable Docker only."""
import json, os, subprocess, uuid, unittest
from concurrent.futures import ThreadPoolExecutor
CONTAINER=os.environ['YHUB_SHEETS_TEST_CONTAINER']
assert CONTAINER.startswith('yhub-sheets-test-')
BASE=['docker','--host=unix:///var/run/docker.sock','exec','-i',CONTAINER,'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']
A,B=[str(uuid.uuid4()) for _ in range(2)]
def run(sql, actor=None, check=True):
    prefix=f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{actor}';" if actor else ''
    result=subprocess.run(BASE,input='BEGIN;'+prefix+sql+';COMMIT;',capture_output=True,text=True,timeout=20)
    if check and result.returncode: raise AssertionError(result.stderr)
    return result

def content(id,name='Book'):
    return dict(id=id,name=name,sheets=[dict(id='s')],activeSheetId='s')
def save(id,request,revision,actor=A,name='Book',check=True):
    data=json.dumps(content(id,name)).replace("'","''")
    return run(f"SELECT public.save_y_sheets_workbook('{id}','{request}',{revision},'{data}','{actor}')",actor,check)
def new():
    id,request=str(uuid.uuid4()),str(uuid.uuid4())
    save(id,request,0)
    return id,request
class Saves(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        run(f"INSERT INTO auth.users(id) VALUES('{A}'),('{B}')")
    def test_replay_lost_ack_and_payload_binding(self):
        id,request=new()
        self.assertEqual(save(id,request,0).stdout.strip(),'1')
        self.assertNotEqual(save(id,request,0,name='Different',check=False).returncode,0)
        self.assertEqual(run(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'",A).stdout.strip(),'1')
    def test_concurrent_cas_exactly_one_winner(self):
        id,_=new()
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda n:save(id,str(uuid.uuid4()),1,name=n,check=False),['One','Two']))
        self.assertEqual(sum(r.returncode==0 for r in results),1)
        self.assertEqual(run(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'",A).stdout.strip(),'2')
    def test_retry_receipt_after_later_writer_does_not_overwrite(self):
        id,_=new(); first=str(uuid.uuid4())
        save(id,first,1,name='First'); save(id,str(uuid.uuid4()),2,name='Second')
        self.assertEqual(save(id,first,1,name='First').stdout.strip(),'2')
        self.assertEqual(run(f"SELECT name FROM public.y_sheets_workbooks WHERE id='{id}'",A).stdout.strip(),'Second')
    def test_user_isolation_and_no_direct_writes(self):
        id,request=new()
        self.assertEqual(run(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'",B).stdout.strip(),'0')
        for sql in [f"UPDATE public.y_sheets_workbooks SET revision=2 WHERE id='{id}'",f"DELETE FROM public.y_sheets_workbooks WHERE id='{id}'","INSERT INTO public.y_sheets_workbooks DEFAULT VALUES","SELECT * FROM y_sheets_private.save_receipts"]:
            self.assertIn('permission denied',run(sql,A,False).stderr)
        self.assertNotEqual(save(id,request,0,B,check=False).returncode,0)
        self.assertNotEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',1)",B,False).returncode,0)
    def test_delete_cas_and_no_resurrection(self):
        id,request=new(); save(id,str(uuid.uuid4()),1)
        self.assertNotEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',1)",A,False).returncode,0)
        self.assertEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',2)",A).stdout.strip(),id)
        self.assertNotEqual(save(id,request,0,check=False).returncode,0)
        self.assertNotEqual(save(id,str(uuid.uuid4()),0,check=False).returncode,0)
    def test_unauthenticated_and_bad_payload_rejected(self):
        self.assertNotEqual(run("SET LOCAL ROLE anon; SELECT public.save_y_sheets_workbook(null,null,0,'{}',null)",check=False).returncode,0)
        invalid=run(f"SELECT public.save_y_sheets_workbook(gen_random_uuid(),gen_random_uuid(),0,'{{}}','{A}')",A,False)
        self.assertNotEqual(invalid.returncode,0)
        self.assertIn('Invalid workbook',invalid.stderr)
    def test_failed_receipt_rolls_back_workbook(self):
        id,_=new()
        try:
            run("CREATE FUNCTION y_sheets_private.fail_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt unavailable'; END $$; CREATE TRIGGER fail_test BEFORE INSERT ON y_sheets_private.save_receipts FOR EACH ROW EXECUTE FUNCTION y_sheets_private.fail_test()")
            self.assertNotEqual(save(id,str(uuid.uuid4()),1,name='Must roll back',check=False).returncode,0)
            self.assertEqual(run(f"SELECT name FROM public.y_sheets_workbooks WHERE id='{id}'",A).stdout.strip(),'Book')
        finally: run('DROP TRIGGER fail_test ON y_sheets_private.save_receipts; DROP FUNCTION y_sheets_private.fail_test()')

    def test_account_switch_between_session_check_and_create_cannot_mix_owners(self):
        id,request=str(uuid.uuid4()),str(uuid.uuid4())
        data=json.dumps(content(id,'Account A private content'))
        result=run(f"SELECT public.save_y_sheets_workbook('{id}','{request}',0,'{data}','{A}')",B,False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Session changed',result.stderr)
        self.assertEqual(run(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'").stdout.strip(),'0')

    def test_all_platform_roles_keep_workbooks_private(self):
        actors=[str(uuid.uuid4()) for _ in range(4)]
        roles=['student','instructor','admin','super_admin']
        for actor,role in zip(actors,roles):
            run(f"INSERT INTO auth.users(id) VALUES('{actor}'); UPDATE public.users SET role='{role}' WHERE id='{actor}'")
        for owner in actors:
            id,request=str(uuid.uuid4()),str(uuid.uuid4())
            self.assertEqual(save(id,request,0,owner).stdout.strip(),'1')
            self.assertEqual(run(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'",owner).stdout.strip(),'1')
            for other in actors:
                if other==owner: continue
                self.assertEqual(run(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'",other).stdout.strip(),'0')
                self.assertNotEqual(save(id,str(uuid.uuid4()),1,other,check=False).returncode,0)
                self.assertNotEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',1)",other,False).returncode,0)
            self.assertEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',1)",owner).stdout.strip(),id)

    def test_missing_session_claim_cannot_create_or_save(self):
        id,request=str(uuid.uuid4()),str(uuid.uuid4())
        data=json.dumps(content(id))
        result=run(f"SET LOCAL ROLE authenticated; SELECT public.save_y_sheets_workbook('{id}','{request}',0,'{data}','{A}')",check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('not authenticated',result.stderr)
        self.assertEqual(run(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'").stdout.strip(),'0')
