import unittest, uuid
from concurrent.futures import ThreadPoolExecutor
from support import run,value,definition,course,I,A,S,U,O
class AcademicArchitecture(unittest.TestCase):
 def test_historical_rows_and_all_ids_are_preserved(self):
  self.assertEqual(value("SELECT count(*) FROM public.courses c JOIN public.test_legacy_snapshot s ON c.id=(s.row->>'id')::uuid WHERE to_jsonb(c)-'course_definition_id'-'section_label'-'academic_term'-'syllabus_revision'=s.row"),'2')
  for table,col,key in [('course_materials','id','3'),('exams','id','4'),('questions','id','5'),('syllabus_units','id','6'),('syllabus_sections','id','7')]:
   self.assertEqual(value(f"SELECT count(*) FROM public.{table} WHERE {col}='10000000-0000-0000-0000-00000000000{key}'"),'1')
  self.assertEqual(value("SELECT count(*) FROM public.course_enrollments WHERE course_id='10000000-0000-0000-0000-000000000001'"),'1')
  self.assertEqual(value("SELECT count(*) FROM public.student_results WHERE exam_id='10000000-0000-0000-0000-000000000004'"),'1')
 def test_equal_historical_codes_never_merge_definitions(self):
  self.assertEqual(value("SELECT count(DISTINCT course_definition_id) FROM public.courses WHERE id::text LIKE '10000000%'"),'2')
  self.assertEqual(value("SELECT count(*) FROM public.course_definitions WHERE legacy_course_id::text LIKE '10000000%' AND academic_major IS NULL"),'2')
 def test_old_client_creation_gets_independent_definition(self):
  first=course();second=course()
  self.assertNotEqual(value(f"SELECT course_definition_id FROM public.courses WHERE id='{first}'"),value(f"SELECT course_definition_id FROM public.courses WHERE id='{second}'"))
 def test_two_instructors_can_explicitly_share_catalog_without_sharing_content(self):
  d=definition();a=course(I,d);b=course(O,d)
  run(f"INSERT INTO public.syllabus_units(course_id,title) VALUES('{a}','Only A')",I)
  self.assertEqual(value(f"SELECT count(*) FROM public.syllabus_units WHERE course_id='{b}'",O),'0')
  self.assertEqual(value(f"SELECT count(*) FROM public.courses WHERE course_definition_id='{d}'"),'2')
 def test_section_view_uses_same_id_and_caller_rls_for_writes(self):
  c=course()
  self.assertEqual(value(f"SELECT id FROM public.course_sections WHERE id='{c}'",I),c)
  self.assertEqual(value(f"UPDATE public.course_sections SET section_label='02',academic_term='2026' WHERE id='{c}' RETURNING id",O),'')
  self.assertEqual(value(f"UPDATE public.course_sections SET section_label='02',academic_term='2026' WHERE id='{c}' RETURNING id",I),c)
  self.assertEqual(value(f"SELECT section_label||'/'||academic_term FROM public.courses WHERE id='{c}'"),'02/2026')
 def test_section_identity_and_mapping_are_immutable(self):
  c=course();d=definition()
  for mutation in [f"course_definition_id='{d}'",f"id='{uuid.uuid4()}'"]:
   self.assertIn('immutable',run(f"UPDATE public.courses SET {mutation} WHERE id='{c}'",I,False).stderr)
 def test_catalog_admin_writes_and_student_major_reads(self):
  d=definition('physics')
  self.assertEqual(value(f"SELECT count(*) FROM public.course_definitions WHERE id='{d}'",U),'0')
  for actor in [I,O,A,S]: self.assertEqual(value(f"SELECT count(*) FROM public.course_definitions WHERE id='{d}'",actor),'1')
  for actor in [I,U]:
   self.assertNotEqual(run("INSERT INTO public.course_definitions(title) VALUES('Forged')",actor,False).returncode,0)
   self.assertEqual(value(f"UPDATE public.course_definitions SET title='Forged' WHERE id='{d}' RETURNING id",actor),'')
  for actor in [A,S]:self.assertEqual(value(f"UPDATE public.course_definitions SET title='Admin edited' WHERE id='{d}' RETURNING id",actor),d)
 def test_definition_cannot_be_deleted_while_referenced(self):
  d=definition();c=course(I,d)
  self.assertNotEqual(run(f"DELETE FROM public.course_definitions WHERE id='{d}'",A,False).returncode,0)
  self.assertEqual(value(f"SELECT id FROM public.courses WHERE id='{c}'"),c)
 def test_deleted_section_not_rebound_by_reused_title_code(self):
  c=course();d=value(f"SELECT course_definition_id FROM public.courses WHERE id='{c}'")
  run(f"INSERT INTO public.syllabus_units(course_id,title) VALUES('{c}','Deleted content')",I)
  run(f"SELECT public.delete_course_confirmed('{c}')",I)
  replacement=course()
  self.assertNotEqual(value(f"SELECT course_definition_id FROM public.courses WHERE id='{replacement}'"),d)
  self.assertEqual(value(f"SELECT count(*) FROM public.syllabus_units WHERE course_id='{replacement}'"),'0')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{c}' AND operation='DELETE'",A),'1')
 def test_catalog_and_section_metadata_are_audited_and_atomic(self):
  d=definition();c=course(I,d)
  run(f"UPDATE public.courses SET academic_term='Term' WHERE id='{c}'",I)
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{c}' AND operation='UPDATE' AND new_values ? 'academic_term'",A),'1')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{d}'",A),'0')
  self.assertEqual(value(f"SELECT count(*) FROM public.audit_events WHERE entity_id='{d}'",S),'1')
  try:
   run("CREATE FUNCTION public.fail_definition_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='course_definitions' THEN RAISE EXCEPTION 'catalog audit failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_definition_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_definition_audit()")
   self.assertIn('catalog audit failed',run("INSERT INTO public.courses(instructor_id,title) VALUES('"+I+"','Should rollback')",I,False).stderr)
   self.assertEqual(value("SELECT count(*) FROM public.courses WHERE title='Should rollback'"),'0')
  finally:run('DROP TRIGGER fail_definition_audit ON public.audit_events; DROP FUNCTION public.fail_definition_audit()')
 def test_concurrent_legacy_creates_do_not_coalesce(self):
  with ThreadPoolExecutor(2) as p:ids=list(p.map(lambda _:course(),range(2)))
  self.assertEqual(value(f"SELECT count(DISTINCT course_definition_id) FROM public.courses WHERE id IN ('{ids[0]}','{ids[1]}')"),'2')
 def test_guest_and_untrusted_missing_identity_cannot_use_compatibility_trigger(self):
  for role in ['anon','authenticated']:
   self.assertNotEqual(run(f"SET LOCAL ROLE {role}; INSERT INTO public.course_sections(instructor_id,title) VALUES('{I}','Forged')",check=False).returncode,0)
