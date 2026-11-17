import json,uuid,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,O,A,I
from test_sheets_folders import workbook,sql,folder,organize

def share(id,permission='edit',revision=0,actor=U,recipient=O,check=True):
 return run('SELECT public.set_y_sheets_share('+','.join(map(sql,[actor,id,recipient,permission,revision]))+')',actor,check)
def read(id,actor=O,grant=None,check=True):
 return run('SELECT public.read_shared_y_sheets('+','.join(map(sql,[actor,id,grant,True]))+')',actor,check)
def save(id,data=None,grant=1,revision=1,request=None,actor=O,check=True):
 if data is None:data=json.loads(read(id,actor).stdout)['workbook']
 return run('SELECT public.save_shared_y_sheets('+','.join(map(sql,[actor,id,grant,request or str(uuid.uuid4()),revision,json.dumps(data)]))+'::jsonb)',actor,check)
class SheetsSharing(unittest.TestCase):
 def test_private_by_default_and_owner_only_management_no_platform_bypass(self):
  id=workbook()
  for actor in [O,A,I]:
   self.assertNotEqual(read(id,actor,check=False).returncode,0)
   self.assertNotEqual(share(id,actor=actor,recipient=U,check=False).returncode,0)
   self.assertNotEqual(run(f"SELECT public.list_y_sheets_shares('{actor}','{id}')",actor,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.y_sheets_workbooks WHERE id='{id}'",O),'0')
 def test_preview_requires_owned_file_and_exact_number_and_no_email(self):
  id=workbook();number=value(f"SELECT user_number FROM public.users WHERE id='{O}'")
  data=json.loads(value(f"SELECT public.preview_y_sheets_recipient('{U}','{id}','{number}')",U))
  self.assertEqual(data['id'],O);self.assertEqual(data['revision'],0);self.assertNotIn('email',data)
  self.assertNotEqual(run(f"SELECT public.preview_y_sheets_recipient('{U}','{id}','123')",U,False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.preview_y_sheets_recipient('{O}','{id}','{number}')",O,False).returncode,0)
  share(id);self.assertEqual(json.loads(value(f"SELECT public.preview_y_sheets_recipient('{U}','{id}','{number}')",U))['revision'],1)
 def test_viewer_reads_but_cannot_edit_rename_delete_move_or_reshare(self):
  id=workbook();share(id,'view');self.assertEqual(json.loads(read(id).stdout)['permission'],'view')
  self.assertNotEqual(save(id,check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.delete_y_sheets_workbook('{id}',1)",O,False).returncode,0)
  self.assertNotEqual(organize(id,'workbook',actor=O,check=False).returncode,0)
  self.assertNotEqual(share(id,actor=O,recipient=A,check=False).returncode,0)
 def test_shared_editor_updates_same_content_revision_and_preserves_owner_and_location(self):
  id=workbook();p=folder();organize(id,'workbook',parent=p);share(id)
  data=json.loads(read(id).stdout)['workbook'];data['sheets'][0]['cells']={'0,0':{'raw':'updated'}}
  self.assertEqual(save(id,data).stdout.strip(),'2')
  self.assertEqual(value(f"SELECT owner_id FROM public.y_sheets_workbooks WHERE id='{id}'"),U)
  self.assertEqual(value(f"SELECT parent_id FROM y_sheets_private.locations WHERE id='{id}'"),p)
  self.assertEqual(json.loads(value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'")),data)
 def test_lost_ack_idempotency_and_changed_request_payload_rejected(self):
  id=workbook();share(id);r=str(uuid.uuid4());data=json.loads(read(id).stdout)['workbook']
  self.assertEqual(save(id,data,request=r).stdout.strip(),'2');self.assertEqual(save(id,data,request=r).stdout.strip(),'2')
  data['sheets'][0]['cells']={};self.assertNotEqual(save(id,data,request=r,check=False).returncode,0)
 def test_revocation_and_downgrade_block_old_reads_writes_and_replay(self):
  for mode in ['none','view']:
   id=workbook();share(id);data=json.loads(read(id).stdout)['workbook'];r=str(uuid.uuid4());save(id,data,request=r)
   share(id,mode,1)
   self.assertNotEqual(read(id,grant=1,check=False).returncode,0)
   self.assertNotEqual(save(id,data,request=r,check=False).returncode,0)
   if mode=='none':self.assertNotEqual(read(id,check=False).returncode,0)
 def test_regrant_does_not_authorize_an_old_editor_epoch(self):
  id=workbook();share(id);data=json.loads(read(id).stdout)['workbook'];share(id,'none',1);share(id,'edit',2)
  self.assertNotEqual(save(id,data,grant=1,check=False).returncode,0)
  self.assertEqual(save(id,data,grant=3).stdout.strip(),'2')
 def test_stale_owner_and_shared_concurrent_edits_have_one_winner(self):
  id=workbook();share(id);data=json.loads(read(id).stdout)['workbook']
  a=json.loads(json.dumps(data));b=json.loads(json.dumps(data));a['sheets'][0]['cells']={'x':'a'};b['sheets'][0]['cells']={'x':'b'}
  owner=f"SELECT public.save_y_sheets_workbook('{id}','{uuid.uuid4()}',1,{sql(json.dumps(a))}::jsonb,'{U}')"
  with ThreadPoolExecutor(2) as pool:
   futures=[pool.submit(run,owner,U,False),pool.submit(save,id,b,check=False)];results=[f.result() for f in futures]
  self.assertEqual(sum(r.returncode==0 for r in results),1);self.assertEqual(value(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'"),'2')
 def test_two_share_changes_one_winner_and_unchanged_retry_no_revision_increment(self):
  id=workbook();share(id)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda mode:share(id,mode,1,check=False),['view','none']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  mode=value(f"SELECT permission FROM y_sheets_private.shares WHERE workbook_id='{id}'")
  self.assertEqual(share(id,mode,1).stdout.strip(),'2')
 def test_deleted_workbook_cannot_be_read_saved_or_recreated_by_recipient(self):
  id=workbook();share(id);data=json.loads(read(id).stdout)['workbook'];value(f"SELECT public.delete_y_sheets_workbook('{id}',1)",U)
  self.assertNotEqual(read(id,check=False).returncode,0);self.assertNotEqual(save(id,data,check=False).returncode,0)
 def test_direct_tables_helpers_and_forged_actor_denied(self):
  id=workbook();share(id)
  for table in ['shares','shared_receipts']:
   self.assertNotEqual(run(f'SELECT * FROM y_sheets_private.{table}',O,False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.read_shared_y_sheets('{O}','{id}')",A,False).returncode,0)
  for role in ['anon','service_role']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.read_shared_y_sheets('{O}','{id}')",check=False).returncode,0)
 def test_incoming_listing_has_no_unrelated_files_and_revokes_immediately(self):
  id=workbook();other=workbook();share(id,'view')
  rows=json.loads(value(f"SELECT public.list_shared_y_sheets('{O}')",O));self.assertIn(id,[r['id'] for r in rows]);self.assertNotIn(other,[r['id'] for r in rows]);self.assertNotIn('content',json.dumps(rows))
  share(id,'none',1);rows=json.loads(value(f"SELECT public.list_shared_y_sheets('{O}')",O));self.assertNotIn(id,[r['id'] for r in rows])
 def test_invalid_content_and_rename_fail_without_partial_update(self):
  id=workbook();share(id);data=json.loads(read(id).stdout)['workbook']
  for patch in [{'name':'Stolen rename'},{'id':str(uuid.uuid4())},{'sheets':[]},{'activeSheetId':'missing'}]:
   self.assertNotEqual(save(id,{**data,**patch},check=False).returncode,0)
  self.assertEqual(value(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'"),'1')
 def test_audit_records_recipient_but_not_content_and_failure_rolls_back(self):
  id=workbook('Private workbook');share(id)
  event=value(f"SELECT id FROM public.audit_events WHERE entity_type='shares' AND new_values->>'workbook_id'='{id}' ORDER BY occurred_at DESC LIMIT 1")
  self.assertTrue(event)
  self.assertEqual(value(f"SELECT person_id FROM public.audit_event_people WHERE event_id='{event}' AND relation='affected'"),O)
  self.assertNotIn('Private workbook',value(f"SELECT row_to_json(e) FROM public.audit_events e WHERE id='{event}'"))
  try:
   run("CREATE FUNCTION public.fail_share_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='shares' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_share_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_share_audit()")
   self.assertNotEqual(share(id,'none',1,check=False).returncode,0);self.assertEqual(json.loads(read(id).stdout)['permission'],'edit')
  finally:run('DROP TRIGGER fail_share_audit ON public.audit_events;DROP FUNCTION public.fail_share_audit()')
 def test_revocation_commits_before_waiting_save_then_save_is_denied(self):
  import subprocess,time
  from support import BASE
  id=workbook();share(id);data=json.loads(read(id).stdout)['workbook']
  p=subprocess.Popen(BASE,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  p.stdin.write(f"BEGIN;SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='{U}';SELECT public.set_y_sheets_share('{U}','{id}','{O}','none',1);SELECT pg_advisory_xact_lock(430505);SELECT pg_sleep(1);COMMIT;");p.stdin.close()
  try:
   deadline=time.monotonic()+8
   while time.monotonic()<deadline:
    if value("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=430505 AND granted")=='1':break
    time.sleep(.02)
   else:self.fail('Revocation did not acquire marker lock')
   self.assertNotEqual(save(id,data,check=False).returncode,0)
   p.wait(timeout=8);self.assertEqual(p.returncode,0,p.stderr.read());self.assertEqual(value(f"SELECT revision FROM public.y_sheets_workbooks WHERE id='{id}'"),'1')
  finally:p.wait(timeout=8);p.stdout.close();p.stderr.close()
