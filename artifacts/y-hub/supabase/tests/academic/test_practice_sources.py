"""Trusted source scope in a disposable local database, including negative cases."""
import json, unittest, uuid
from concurrent.futures import ThreadPoolExecutor
from support import run, value, course, I, A, S, U, O

def literal(data): return "'" + json.dumps(data).replace("'", "''") + "'::jsonb"
def source(c, title='Lecture', chunks=None):
 m=str(uuid.uuid4())
 run(f"INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{m}','{c}','{title}','pdf','https://local.invalid/book.pdf')",I)
 s=value(f"SELECT id FROM public.ai_tutor_sources WHERE material_id='{m}'")
 r=value(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{s}'")
 publish(s,r,chunks if chunks is not None else [{'text':'إشارة المشتقة derivative','page':2},{'text':'vector space','page':4}])
 return {'sourceId':s,'revision':r,'pages':[]}
def publish(s,r,chunks):run(f"SELECT public.publish_ai_tutor_source('{I}','{s}','{r}',{literal(chunks)})")
def setup():
 c=course();run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U);return c,source(c)
def catalog(c,actor=U):return json.loads(value(f"SELECT public.get_ai_practice_sources('{c}')",actor))
def preview(c,picks,units=(),query='',actor=U,check=True):
 ids=','.join("'"+x+"'::uuid" for x in units)
 return run(f"SELECT public.preview_ai_practice_sources('{c}',{literal(picks)},ARRAY[{ids}]::uuid[],'{query}')",actor,check)
def assign(pick,role,rev=0,primary=None,actor=I,check=True):
 expected="'"+primary+"'::uuid" if primary else 'NULL'
 return run(f"SELECT public.set_ai_practice_reference('{pick['sourceId']}','{pick['revision']}',{rev},'{role}',{expected})",actor,check)

class PracticeSources(unittest.TestCase):
 def test_catalog_pages_and_server_selected_evidence(self):
  c,p=setup();row=next(x for x in catalog(c)['sources'] if x['id']==p['sourceId'])
  self.assertEqual(row['pages'],[2,4]);self.assertEqual(row['role'],'lecture');self.assertFalse(catalog(c)['canManage'])
  data=json.loads(preview(c,[{**p,'pages':[4]}]).stdout)
  self.assertEqual(data['evidence'][0]['text'],'vector space');self.assertEqual(data['evidence'][0]['page'],4)
  self.assertEqual(data['evidence'][0]['revision'],p['revision'])
 def test_priority_multiple_references_and_bounded_diverse_context(self):
  c,p=setup();q=source(c,'Primary',[{'text':f'derivative {i}','page':i+1} for i in range(8)])
  assign(q,'primary');assign(p,'reference');data=json.loads(preview(c,[p,q]).stdout)
  self.assertEqual(len(data['evidence']),6);self.assertTrue(data['hasMore'])
  self.assertEqual(data['evidence'][0]['source_id'],q['sourceId']);self.assertIn(p['sourceId'],[e['source_id'] for e in data['evidence']])
 def test_cross_section_and_forged_metadata_rejected(self):
  c,p=setup();other=source(course())
  for picks in [[other],[{**p,'text':'forged'}],[{**p,'title':'forged'}],[p,p],[]]:
   self.assertNotEqual(preview(c,picks,check=False).returncode,0)
  self.assertNotEqual(preview(c,[p],actor=O,check=False).returncode,0)
 def test_only_actual_indexed_pdf_pages_accepted(self):
  c,p=setup()
  for pages in [[1],[3],[0],[301],[2.5],['2'],[True],[None]]:
   self.assertNotEqual(preview(c,[{**p,'pages':pages}],check=False).returncode,0)
 def test_units_are_scoped_and_never_guessed_from_pdf_pages(self):
  c,p=setup();u=str(uuid.uuid4());run(f"INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{u}','{c}','Calculus')",I)
  s=value(f"SELECT id FROM public.ai_tutor_sources WHERE course_id='{c}' AND kind='syllabus'");r=value(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{s}'")
  publish(s,r,[{'text':'Derivative topic','unitId':u}]);picks=[p,{'sourceId':s,'revision':r,'pages':[]}]
  data=json.loads(preview(c,picks,[u]).stdout);self.assertEqual(len(data['evidence']),1);self.assertEqual(data['evidence'][0]['unit_id'],u)
  self.assertIsNone(data['evidence'][0]['page']);self.assertNotEqual(preview(c,picks,[str(uuid.uuid4())],check=False).returncode,0)
 def test_replacement_unreadable_and_deleted_sources_invalidate_scope(self):
  c,p=setup();publish(p['sourceId'],p['revision'],[])
  self.assertNotEqual(preview(c,[p],check=False).returncode,0)
  publish(p['sourceId'],p['revision'],[{'text':'new','page':2}])
  run(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid(),status='pending' WHERE id='{p['sourceId']}'")
  self.assertNotEqual(preview(c,[p],check=False).returncode,0)
  self.assertNotEqual(assign(p,'primary',check=False).returncode,0)
  run(f"DELETE FROM public.course_materials WHERE id=(SELECT material_id FROM public.ai_tutor_sources WHERE id='{p['sourceId']}')",I)
  self.assertNotEqual(preview(c,[p],check=False).returncode,0)
 def test_current_roles_withdrawal_and_no_admin_content_bypass(self):
  c,p=setup();assign(p,'reference')
  for actor in [U,O,A,S]:self.assertNotEqual(assign(p,'primary',1,actor=actor,check=False).returncode,0)
  for actor in [O,A,S]:self.assertNotEqual(preview(c,[p],actor=actor,check=False).returncode,0)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(preview(c,[p],check=False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_references WHERE course_id='{c}'",U),'0')
  try:
   run(f"SELECT public.admin_set_user_role('{I}','student')",S)
   self.assertNotEqual(assign(p,'primary',1,check=False).returncode,0)
  finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)
 def test_primary_replacement_is_atomic_cas_and_retry_is_idempotent(self):
  c,p=setup();q=source(c);assign(p,'primary');self.assertEqual(int(assign(p,'primary').stdout),1)
  self.assertNotEqual(assign(q,'primary',check=False).returncode,0)
  assign(q,'primary',primary=p['sourceId']);data=catalog(c)
  self.assertEqual(data['primaryId'],q['sourceId']);self.assertEqual(next(s for s in data['sources'] if s['id']==p['sourceId'])['policyRevision'],2)
  self.assertNotEqual(assign(p,'lecture',1,check=False).returncode,0)
 def test_concurrent_primary_choices_have_one_winner(self):
  c,p=setup();q=source(c)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda pick:assign(pick,'primary',check=False),[p,q]))
  self.assertEqual(sum(x.returncode==0 for x in results),1)
  self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_references WHERE course_id='{c}' AND role='primary'"),'1')
 def test_direct_mutation_and_anonymous_execution_denied(self):
  c,p=setup()
  for actor in [U,I,A,S]:
   for sql in ['INSERT INTO public.ai_practice_references DEFAULT VALUES',"UPDATE public.ai_practice_references SET role='primary'",'DELETE FROM public.ai_practice_references']:
    self.assertNotEqual(run(sql,actor,False).returncode,0)
  self.assertNotEqual(run(f"SET LOCAL ROLE anon;SELECT public.get_ai_practice_sources('{c}')",check=False).returncode,0)
 def test_required_audit_and_primary_demotion_rollback_together(self):
  c,p=setup();q=source(c);assign(p,'primary')
  try:
   run("CREATE FUNCTION public.fail_reference_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='ai_practice_references' THEN RAISE EXCEPTION 'Required audit failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_reference BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_reference_audit()")
   self.assertNotEqual(assign(q,'primary',primary=p['sourceId'],check=False).returncode,0);self.assertEqual(catalog(c)['primaryId'],p['sourceId'])
  finally:run('DROP TRIGGER fail_reference ON public.audit_events; DROP FUNCTION public.fail_reference_audit()')
  self.assertEqual(value(f"SELECT actor_id FROM public.audit_events WHERE entity_type='ai_practice_references' AND entity_id='{p['sourceId']}'",A),I)
 def test_arabic_search_preserves_original_evidence_and_empty_result_is_honest(self):
  c,p=setup();data=json.loads(preview(c,[p],query='اشارة المشتقة').stdout)
  self.assertEqual(data['evidence'][0]['text'],'إشارة المشتقة derivative')
  self.assertEqual(json.loads(preview(c,[p],query='unrelated').stdout)['evidence'],[])
