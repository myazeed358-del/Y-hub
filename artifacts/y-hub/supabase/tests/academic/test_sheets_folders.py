"""Decision43: real local SQL authorization, tree invariants and content preservation."""
import json,uuid,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,A,U,O

def sql(v):
 if v is None:return 'NULL'
 if isinstance(v,bool):return str(v).lower()
 if isinstance(v,int):return str(v)
 return "'"+str(v).replace("'","''")+"'"
def folder(name='Folder',parent=None,actor=U):
 id=str(uuid.uuid4());organize(id,parent=parent,name=name,actor=actor);return id

def organize(id,kind='folder',revision=0,parent=None,name='Folder',favorite=False,pinned=False,actor=U,check=True,owner=None):
 args=[owner or actor,kind,id,revision,parent,name if kind=='folder' else None,favorite,pinned]
 return run('SELECT public.organize_y_sheets('+','.join(map(sql,args))+')',actor,check)
def browse(actor=U,parent=None,view='folder',search='',sort='name',offset=0,only=False):
 args=[actor,parent,view,search,sort,offset,only]
 return json.loads(value('SELECT public.browse_y_sheets('+','.join(map(sql,args))+')',actor))
def workbook(name='Book',actor=U):
 id=str(uuid.uuid4());data={'id':id,'name':name,'sheets':[{'id':'sheet','cells':{'A1':'private formula'}}],'activeSheetId':'sheet'}
 value(f"SELECT public.save_y_sheets_workbook('{id}','{uuid.uuid4()}',0,{sql(json.dumps(data))}::jsonb,'{actor}')",actor);return id

def found(id,actor=U):
 return next(x for x in browse(actor,view='all',search=id)['items'] if x['id']==id)
class SheetsFolders(unittest.TestCase):
 def test_existing_content_and_revision_are_unchanged_by_move_and_flags(self):
  id=workbook();before=value(f"SELECT row_to_json(w) FROM public.y_sheets_workbooks w WHERE id='{id}'")
  p=folder();organize(id,'workbook',parent=p,favorite=True,pinned=True)
  self.assertEqual(value(f"SELECT row_to_json(w) FROM public.y_sheets_workbooks w WHERE id='{id}'"),before)
  row=next(x for x in browse(parent=p)['items'] if x['id']==id)
  self.assertTrue(row['favorite']);self.assertTrue(row['pinned']);self.assertEqual(row['organization_revision'],1)
 def test_old_workbook_without_location_is_in_root(self):
  id=workbook(str(uuid.uuid4()));name=value(f"SELECT name FROM public.y_sheets_workbooks WHERE id='{id}'")
  row=next(x for x in browse(search=name)['items'] if x['id']==id)
  self.assertIsNone(row['parent_id']);self.assertEqual(row['organization_revision'],0)
 def test_nested_navigation_and_rename_preserve_children(self):
  root=folder();child=folder(parent=root);leaf=folder(parent=child)
  organize(root,revision=1,name='Renamed')
  data=browse(parent=leaf);self.assertEqual([x['id'] for x in data['trail']],[root,child,leaf]);self.assertEqual(data['trail'][0]['name'],'Renamed')
 def test_arbitrary_depth_without_recursive_stack_or_fixed_depth_limit(self):
  # One transaction exercises the public writer 105 times, beyond typical UI depth caps.
  ids=[str(uuid.uuid4()) for _ in range(105)]
  run(';'.join('SELECT public.organize_y_sheets('+','.join(map(sql,[U,'folder',id,0,ids[i-1] if i else None,'Deep',False,False]))+')' for i,id in enumerate(ids)),U)
  self.assertEqual(len(browse(parent=ids[-1])['trail']),105)
  self.assertIn('cycle',organize(ids[0],revision=1,parent=ids[-1],check=False).stderr)
 def test_self_and_descendant_moves_rejected_atomically(self):
  a=folder();b=folder(parent=a)
  for p in [a,b]: self.assertIn('cycle',organize(a,revision=1,parent=p,check=False).stderr)
  self.assertEqual([x['id'] for x in browse(parent=b)['trail']],[a,b])
 def test_opposite_concurrent_moves_cannot_create_cycle(self):
  a=folder();b=folder()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda pair:organize(pair[0],revision=1,parent=pair[1],check=False),[(a,b),(b,a)]))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
 def test_concurrent_edits_have_one_winner_and_retry_is_idempotent(self):
  a=folder()
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda n:organize(a,revision=1,name=n,check=False),['First','Second']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  name=value(f"SELECT name FROM public.y_sheets_folders WHERE id='{a}'")
  self.assertEqual(organize(a,revision=1,name=name).stdout.strip(),'2')
  self.assertIn('changed',organize(a,revision=1,name='Stale',check=False).stderr)
 def test_foreign_folder_workbook_destination_and_owner_hint_are_denied(self):
  a=folder(actor=O);w=workbook(actor=O);own=folder()
  for result in [organize(a,revision=1,check=False),organize(w,'workbook',check=False),organize(own,revision=1,parent=a,check=False),organize(own,revision=1,owner=O,check=False)]:self.assertNotEqual(result.returncode,0)
  self.assertNotEqual(run(f"SELECT public.browse_y_sheets('{U}','{a}')",U,False).returncode,0)
  self.assertEqual(browse(actor=A,search=a)['items'],[])
 def test_browser_cannot_directly_read_or_forge_metadata_or_service_calls(self):
  for table in ['public.y_sheets_folders','y_sheets_private.locations']:
   self.assertNotEqual(run(f'SELECT * FROM {table}',U,False).returncode,0)
   self.assertNotEqual(run(f'DELETE FROM {table}',U,False).returncode,0)
  for role in ['anon','service_role']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.browse_y_sheets('{U}')",check=False).returncode,0)
 def test_global_literal_search_and_filters_do_not_duplicate_files(self):
  token=str(uuid.uuid4());p=folder();id=workbook(token+'%_');organize(id,'workbook',parent=p,favorite=True,pinned=True)
  for view in ['all','favorite','pinned']:
   rows=browse(view=view,search=token)['items'];self.assertEqual([r['id'] for r in rows],[id])
  self.assertEqual(browse(search=token+'%_')['items'][0]['id'],id)
  self.assertEqual(browse(search=token+'XX')['items'],[])
 def test_sorted_paging_and_folders_only(self):
  p=folder();ids=[folder(f'{i:03}',p) for i in range(53)]
  first=browse(parent=p)['items'];second=browse(parent=p,offset=50)['items']
  self.assertEqual(len(first),51);self.assertEqual([r['id'] for r in first[:50]+second],ids)
  w=workbook();organize(w,'workbook',parent=p)
  self.assertTrue(all(r['kind']=='folder' for r in browse(parent=p,only=True)['items']))
 def test_move_does_not_break_existing_content_save_receipts(self):
  id=workbook();p=folder();organize(id,'workbook',parent=p)
  content=json.loads(value(f"SELECT content FROM public.y_sheets_workbooks WHERE id='{id}'"));content['name']='Edited'
  request=str(uuid.uuid4());statement=f"SELECT public.save_y_sheets_workbook('{id}','{request}',1,{sql(json.dumps(content))}::jsonb,'{U}')"
  self.assertEqual(value(statement,U),'2');self.assertEqual(value(statement,U),'2')
  self.assertEqual(value(f"SELECT parent_id FROM y_sheets_private.locations WHERE id='{id}'"),p)
 def test_delete_existing_file_cascades_location_and_cannot_resurrect(self):
  id=workbook();organize(id,'workbook',favorite=True)
  value(f"SELECT public.delete_y_sheets_workbook('{id}',1)",U)
  self.assertEqual(value(f"SELECT count(*) FROM y_sheets_private.locations WHERE id='{id}'"),'0')
  self.assertNotEqual(organize(id,'workbook',revision=1,check=False).returncode,0)
 def test_audit_is_mandatory_and_omits_names_and_content(self):
  secret='Private '+str(uuid.uuid4());id=folder(secret)
  audit=value(f"SELECT string_agg(row_to_json(e)::text,'') FROM public.audit_events e WHERE entity_id='{id}'")
  self.assertNotIn(secret,audit);self.assertIn('[REDACTED]',audit)
  try:
   run("CREATE FUNCTION public.fail_folder_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='y_sheets_folders' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_folder_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_folder_audit()")
   self.assertIn('audit unavailable',organize(id,revision=1,name='New',check=False).stderr)
   self.assertEqual(value(f"SELECT name FROM public.y_sheets_folders WHERE id='{id}'"),secret)
  finally:run('DROP TRIGGER fail_folder_audit ON public.audit_events;DROP FUNCTION public.fail_folder_audit()')
 def test_invalid_arguments_are_rejected(self):
  for args in [dict(name=' '),dict(name='x'*201),dict(kind='other'),dict(revision=-1)]:
   self.assertNotEqual(organize(str(uuid.uuid4()),check=False,**args).returncode,0)
  self.assertNotEqual(run(f"SELECT public.browse_y_sheets('{U}',p_offset=>-1)",U,False).returncode,0)
