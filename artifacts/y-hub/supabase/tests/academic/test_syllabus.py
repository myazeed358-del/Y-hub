import json,time,unittest,uuid
from concurrent.futures import ThreadPoolExecutor
from support import run,value,definition,course,I,A,S,U,O

def unit(title='Unit',topics=('Topic',)):
 return {'id':str(uuid.uuid4()),'title':title,'sections':[{'id':str(uuid.uuid4()),'title':t} for t in topics]}
def save(c,revision,units,actor=I,check=True):
 payload=json.dumps(units).replace("'","''")
 return run(f"SELECT public.save_course_syllabus('{c}',{revision},'{payload}'::jsonb)",actor,check)
def read(c,actor=I):return json.loads(value(f"SELECT public.read_course_syllabus('{c}')",actor) or 'null')
class SyllabusPermissions(unittest.TestCase):
 def test_create_edit_reorder_delete_roundtrip_and_noop(self):
  c=course();units=[unit('First'),unit('Second',('One','Two'))]
  r=int(save(c,0,units).stdout);self.assertEqual(read(c)['units'],units)
  self.assertEqual(int(save(c,r,units).stdout),r,'No-op must not bump revision')
  units.reverse();units[0]['sections'].reverse();units[0]['title']='Renamed'
  r=int(save(c,r,units).stdout);self.assertEqual(read(c)['units'],units)
  r=int(save(c,r,[units[0]]).stdout);self.assertEqual(read(c)['units'],[units[0]])
  save(c,r,[]);self.assertEqual(read(c)['units'],[])
 def test_students_read_only_their_published_enrolled_section(self):
  d=definition();a=course(I,d);b=course(O,d)
  save(a,0,[unit('A')]);save(b,0,[unit('B')],O)
  self.assertIsNone(read(a,U))
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{a}','{U}')",U)
  self.assertEqual(read(a,U)['units'][0]['title'],'A');self.assertIsNone(read(b,U))
  self.assertNotEqual(save(a,read(a)['revision'],[],U,False).returncode,0)
  run(f"UPDATE public.courses SET is_published=false WHERE id='{a}'",I)
  self.assertIsNone(read(a,U))
 def test_instructor_cross_section_read_leak_is_closed(self):
  a=course();save(a,0,[unit()])
  run(f"INSERT INTO public.course_materials(course_id,title,type,url) VALUES('{a}','Private','link','https://example.invalid')",I)
  for table,predicate in [('courses',f"id='{a}'"),('course_sections',f"id='{a}'"),('course_materials',f"course_id='{a}'"),('syllabus_units',f"course_id='{a}'")]:
   self.assertEqual(value(f"SELECT count(*) FROM public.{table} WHERE {predicate}",O),'0')
  self.assertIsNone(read(a,O));self.assertNotEqual(save(a,0,[],O,False).returncode,0)
 def test_major_discovery_and_enrollment_are_database_enforced(self):
  c=course(I,definition('physics'))
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{c}'",U),'0')
  self.assertNotEqual(run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')",U,False).returncode,0)
  # Historical active enrollment is deliberately grandfathered, never silently destroyed.
  run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{U}')")
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{c}'",U),'1')
 def test_admin_read_does_not_imply_cross_owner_management(self):
  c=course();save(c,0,[unit()])
  for actor in [A,S]:
   self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{c}'",actor),'1')
   self.assertNotEqual(save(c,read(c)['revision'],[],actor,False).returncode,0)
   own=course(actor);save(own,0,[unit('Owned')],actor)
   self.assertEqual(read(own,actor)['units'][0]['title'],'Owned')
 def test_two_simultaneous_saves_have_one_winner(self):
  c=course()
  with ThreadPoolExecutor(2) as p:results=list(p.map(lambda name:save(c,0,[unit(name)],check=False),['A','B']))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  self.assertIn('Syllabus changed',next(r.stderr for r in results if r.returncode))
  self.assertEqual(len(read(c)['units']),1)
 def test_direct_edits_increment_revision_and_old_snapshot_fails(self):
  c=course();u=unit();r=int(save(c,0,[u]).stdout)
  run(f"UPDATE public.syllabus_sections SET title='Concurrent' WHERE id='{u['sections'][0]['id']}'",I)
  self.assertGreater(read(c)['revision'],r)
  self.assertNotEqual(save(c,r,[u],check=False).returncode,0)
  self.assertEqual(read(c)['units'][0]['sections'][0]['title'],'Concurrent')
 def test_moving_units_or_topics_to_another_parent_is_denied(self):
  a=course();b=course();u=unit();v=unit();save(a,0,[u]);save(b,0,[v])
  for table,id,change in [('syllabus_units',u['id'],f"course_id='{b}'"),('syllabus_sections',u['sections'][0]['id'],f"unit_id='{v['id']}'")]:
   self.assertIn('immutable',run(f"UPDATE public.{table} SET {change} WHERE id='{id}'",I,False).stderr)
  self.assertNotEqual(save(b,read(b)['revision'],[u],check=False).returncode,0)
  self.assertEqual(read(a)['units'],[u]);self.assertEqual(read(b)['units'],[v])
 def test_invalid_graph_rolls_back_without_partial_delete(self):
  c=course();u=unit();r=int(save(c,0,[u]).stdout)
  for payload in [[unit('')],[u,u],[{'id':u['id'],'title':'Bad','sections':None}],[{'id':u['id'],'title':'Bad','sections':[],'actor':S}]]:
   self.assertNotEqual(save(c,r,payload,check=False).returncode,0)
   self.assertEqual(read(c)['units'],[u]);self.assertEqual(read(c)['revision'],r)
 def test_failed_audit_rolls_back_entire_syllabus_and_revision(self):
  c=course();u=unit();r=int(save(c,0,[u]).stdout)
  try:
   run("CREATE FUNCTION public.fail_syllabus_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='syllabus_units' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_syllabus_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_syllabus_audit()")
   self.assertIn('audit unavailable',save(c,r,[],check=False).stderr)
   self.assertEqual(read(c)['units'],[u]);self.assertEqual(read(c)['revision'],r)
  finally:run('DROP TRIGGER fail_syllabus_audit ON public.audit_events; DROP FUNCTION public.fail_syllabus_audit()')
 def test_zero_row_rls_delete_is_not_reported_as_saved(self):
  c=course();u=unit();r=int(save(c,0,[u]).stdout)
  try:
   run('CREATE POLICY test_syllabus_delete_deny ON public.syllabus_units AS RESTRICTIVE FOR DELETE TO authenticated USING(false)')
   self.assertIn('deletion denied',save(c,r,[],check=False).stderr)
   self.assertEqual(read(c)['units'],[u]);self.assertEqual(read(c)['revision'],r)
  finally:run('DROP POLICY test_syllabus_delete_deny ON public.syllabus_units')
 def test_client_cannot_forge_revision_or_identity(self):
  c=course()
  self.assertIn('server managed',run(f"UPDATE public.courses SET syllabus_revision=500 WHERE id='{c}'",I,False).stderr)
  self.assertEqual(read(c)['revision'],0)
  for role in ['anon','authenticated']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role}; SELECT public.save_course_syllabus('{c}',0,'[]')",check=False).returncode,0)
 def test_demotion_committing_during_authorization_prevents_save(self):
  c=course(O)
  try:
   with ThreadPoolExecutor(2) as pool:
    revoke=pool.submit(run,f"UPDATE public.users SET role='student' WHERE id='{O}'; SELECT pg_sleep(.7)")
    time.sleep(.2);saving=pool.submit(save,c,0,[unit()],O,False)
    revoke.result();self.assertNotEqual(saving.result().returncode,0)
   self.assertEqual(value(f"SELECT count(*) FROM public.syllabus_units WHERE course_id='{c}'"),'0')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{O}'")
 def test_audit_visibility_and_title_redaction(self):
  c=course();u=unit('SECRET TITLE');r=int(save(c,0,[u]).stdout)
  events=json.loads(value(f"SELECT jsonb_agg(e) FROM public.audit_events e WHERE entity_id='{u['id']}'",A))
  self.assertEqual(len(events),1);self.assertNotIn('SECRET TITLE',json.dumps(events))
  self.assertEqual(events[0]['actor_id'],I)
  save(c,r,[])
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{u['id']}' AND operation='DELETE'",A),'1')
 def test_future_restrictive_updates_still_apply(self):
  c=course();u=unit();r=int(save(c,0,[u]).stdout);u['title']='Forbidden'
  try:
   run('CREATE POLICY test_syllabus_update_deny ON public.syllabus_units AS RESTRICTIVE FOR UPDATE TO authenticated USING(false)')
   self.assertIn('write denied',save(c,r,[u],check=False).stderr)
   self.assertEqual(read(c)['units'][0]['title'],'Unit')
  finally:run('DROP POLICY test_syllabus_update_deny ON public.syllabus_units')

 def test_deleted_uuid_cannot_be_reused_even_with_explicit_definition(self):
  d=definition();c=course(I,d)
  run(f"SELECT public.delete_course_confirmed('{c}')",I)
  result=run(f"INSERT INTO public.course_sections(id,course_definition_id,instructor_id,title) VALUES('{c}','{d}','{I}','Replacement')",I,False)
  self.assertIn('cannot be reused',result.stderr)
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE id='{c}'"),'0')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{c}' AND operation='DELETE'",A),'1')
 def test_private_functions_and_claimed_role_cannot_bypass_permissions(self):
  c=course()
  result=run(f"CREATE TEMP TABLE users(id uuid,role text); INSERT INTO users VALUES('{U}','super_admin'); SET LOCAL search_path=pg_temp,public; SET LOCAL request.jwt.claim.role='super_admin'; SELECT public.save_course_syllabus('{c}',0,'[]')",U,False)
  self.assertNotEqual(result.returncode,0)
  self.assertEqual(value("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='yhub_academic_private' AND has_function_privilege('authenticated',p.oid,'EXECUTE')"),'0')
  for sql in [f"SELECT * FROM public.course_sections WHERE id='{c}'",f"SELECT public.read_course_syllabus('{c}')"]:
   self.assertNotEqual(run('SET LOCAL ROLE anon; '+sql,check=False).returncode,0)
 def test_demoted_enrolled_owner_cannot_read_answer_keys_or_other_students_results(self):
  c=course(O);e,q=str(uuid.uuid4()),str(uuid.uuid4())
  run(f"INSERT INTO public.exams(id,course_id,title,is_published) VALUES('{e}','{c}','Exam',true); INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('{q}','{c}','{e}','tf','Question','SECRET KEY')",O)
  run(f"INSERT INTO public.student_results(exam_id,student_id,score,total_score) VALUES('{e}','{U}',1,1)")
  self.assertEqual(value(f"SELECT correct_answer FROM public.questions WHERE id='{q}'",O),'SECRET KEY')
  self.assertEqual(value(f"SELECT count(*) FROM public.student_results WHERE exam_id='{e}'",O),'1')
  try:
   run(f"UPDATE public.users SET role='student' WHERE id='{O}'")
   run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{c}','{O}')",O)
   observed=(value(f"SELECT count(*) FROM public.questions WHERE id='{q}'",O),value(f"SELECT count(*) FROM public.student_results WHERE exam_id='{e}'",O))
   self.assertEqual(observed,('0','0'),'Historical ownership must not retain answer keys or other students results after demotion')
   self.assertEqual(value(f"SELECT count(*) FROM public.student_results WHERE exam_id='{e}'",U),'1','Students retain their own historical results')
  finally:run(f"UPDATE public.users SET role='instructor' WHERE id='{O}'")
