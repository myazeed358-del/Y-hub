"""Real PostgreSQL transactions/RLS, via local docker exec; never accepts a DB URL."""
import json
import os
import subprocess
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor

CONTAINER = os.environ['YHUB_AUDIT_TEST_CONTAINER']
if not CONTAINER.startswith('yhub-audit-test-'):
    raise RuntimeError('Only an isolated test container is permitted')
BASE = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', CONTAINER,
        'psql', '-h', '127.0.0.1', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
I, A, S, STUDENT, OTHER, S2 = [f'00000000-0000-0000-0000-00000000000{i}' for i in range(1, 7)]

def command(sql, actor=None, role='authenticated'):
    prefix = 'BEGIN;'
    if actor is not None:
        prefix += f"SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub='{actor}'; SET LOCAL request.jwt.claim.role='{role}';"
    return prefix + sql + ';COMMIT;'

def run(sql, actor=None, role='authenticated', check=True):
    result = subprocess.run(BASE, input=command(sql, actor, role), text=True, capture_output=True, timeout=20)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def query(sql, actor=None):
    out = run(f"SELECT coalesce(jsonb_agg(t),'[]') FROM ({sql}) t", actor).stdout.strip()
    return json.loads(out)

def course(actor=I):
    cid = str(uuid.uuid4())
    run(f"INSERT INTO public.courses(id,instructor_id,title,is_published,enrollment_open) VALUES ('{cid}','{actor}','Sensitive title',true,true)", actor)
    return cid

def events(entity, actor=None):
    return query(f"SELECT * FROM public.audit_events WHERE entity_id='{entity}' ORDER BY occurred_at,id", actor)

class AuditTests(unittest.TestCase):
    def test_insert_update_delete_and_redaction(self):
        cid = course()
        first = events(cid)[0]
        self.assertEqual((first['actor_id'], first['actor_role'], first['actor_name']), (I, 'instructor', 'Audit Tester 1'))
        self.assertEqual(first['operation'], 'INSERT')
        self.assertEqual(first['new_values']['title'], '[REDACTED]')
        run(f"UPDATE public.courses SET title='password secret token',description='private content',is_published=false,enrollment_open=false WHERE id='{cid}'", I)
        update = events(cid)[1]
        self.assertEqual(update['old_values']['is_published'], True)
        self.assertEqual(update['new_values']['is_published'], False)
        self.assertEqual(update['actions'], ['updated','unpublished','enrollment_closed'])
        self.assertNotIn('password secret token', json.dumps(update))
        run(f"DELETE FROM public.courses WHERE id='{cid}'", I)
        self.assertEqual(len(events(cid)), 3)
        self.assertEqual(events(cid)[2]['operation'], 'DELETE')
        self.assertEqual(len(events(cid, A)), 3)

    def test_noop_does_not_duplicate(self):
        cid = course()
        run(f"UPDATE public.courses SET title=title,is_published=is_published WHERE id='{cid}'", I)
        self.assertEqual(len(events(cid)), 1)

    def test_reader_isolation_direct_and_rpc(self):
        instructor_course, admin_course = course(), course(A)
        self.assertEqual(events(instructor_course, I), [])
        self.assertEqual(events(instructor_course, STUDENT), [])
        self.assertEqual(len(events(instructor_course, A)), 1)
        self.assertEqual(events(admin_course, A), [])
        self.assertEqual(len(events(admin_course, S)), 1)
        self.assertEqual(query("SELECT * FROM public.search_audit_events()", I), [])
        self.assertTrue(all(e['actor_role']=='instructor' and not e['super_admin_only'] for e in query("SELECT * FROM public.search_audit_events()", A)))
        self.assertNotEqual(run("SELECT * FROM public.audit_events", '', role='anon', check=False).returncode, 0)

    def test_no_browser_forgery_or_mutation(self):
        cid = course()
        eid = events(cid)[0]['id']
        for actor in (I, A, S, STUDENT):
            for sql in (
                "INSERT INTO public.audit_events DEFAULT VALUES",
                f"UPDATE public.audit_events SET actor_name='Forged' WHERE id='{eid}'",
                f"DELETE FROM public.audit_events WHERE id='{eid}'",
                "TRUNCATE public.audit_events",
                "INSERT INTO public.audit_notifications DEFAULT VALUES",
                "DELETE FROM public.audit_notifications",
                "SELECT yhub_audit_private.capture()",
                "SELECT public.requeue_audit_notifications()",
            ):
                with self.subTest(actor=actor, sql=sql):
                    result = run(sql, actor, check=False)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('permission denied', result.stderr)
        self.assertEqual(events(cid)[0]['actor_name'], 'Audit Tester 1')

    def test_role_change_reserved_and_snapshot(self):
        target = str(uuid.uuid4())
        run(f"INSERT INTO auth.users(id,email) VALUES('{target}','role-test@example.invalid')")
        run(f"SELECT public.admin_set_user_role('{target}','instructor')", A)
        event = events(target)[-1]
        self.assertEqual(event['actor_role'], 'admin')
        self.assertEqual(event['old_values']['role'], 'student')
        self.assertEqual(event['new_values']['role'], 'instructor')
        self.assertTrue(event['super_admin_only'])
        self.assertEqual(events(target, A), [])
        self.assertTrue(events(target, S))
        self.assertEqual(query(f"SELECT * FROM public.audit_notifications WHERE event_id='{event['id']}'", A), [])
        self.assertEqual(len(query(f"SELECT * FROM public.audit_notifications WHERE event_id='{event['id']}'", S)), 1)

    def test_system_identity_and_personal_data_omission(self):
        target = str(uuid.uuid4())
        run(f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{target}','secret@example.invalid','{{\"phone\":\"secret-phone\"}}')")
        event = events(target)[0]
        self.assertIsNone(event['actor_id'])
        self.assertEqual(event['actor_role'], 'system')
        self.assertNotIn('secret', json.dumps(event))
        before = len(events(STUDENT))
        run("SELECT public.update_own_profile('{\"phone\":\"private-phone\"}')", STUDENT)
        self.assertEqual(len(events(STUDENT)), before)
        run(f"UPDATE public.users SET major='physics' WHERE id='{target}'")
        self.assertIn('access_changed', events(target)[-1]['actions'])
        self.assertNotEqual(run("INSERT INTO public.courses(title) VALUES('forged system')", '', check=False).returncode, 0)

    def test_cascade_retention_material_exam_questions_syllabus(self):
        cid = course()
        mid, eid, qid, uid, sid = [str(uuid.uuid4()) for _ in range(5)]
        run(f"""INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{mid}','{cid}','Private','pdf','https://secret.invalid/token');
          INSERT INTO public.exams(id,course_id,title) VALUES('{eid}','{cid}','Exam');
          INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('{qid}','{cid}','{eid}','math','Private question','secret-answer');
          INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{uid}','{cid}','Unit');
          INSERT INTO public.syllabus_sections(id,unit_id,title) VALUES('{sid}','{uid}','Section');
          UPDATE public.exams SET is_published=true WHERE id='{eid}';
          UPDATE public.questions SET points=3,correct_answer='new-secret' WHERE id='{qid}';
          UPDATE public.syllabus_sections SET title='Revised' WHERE id='{sid}';
          DELETE FROM public.courses WHERE id='{cid}'""", I)
        for entity in (cid, mid, eid, qid, uid, sid):
            ev = events(entity, A)
            self.assertEqual(ev[-1]['operation'], 'DELETE')
            self.assertEqual(ev[-1]['actor_id'], I)
            self.assertNotIn('secret', json.dumps(ev))
        self.assertIn('published', events(eid)[1]['actions'])
        self.assertEqual(events(qid)[1]['new_values']['points'], 3)
        self.assertEqual([len(events(key)) for key in (cid, mid, eid, qid, uid, sid)], [2, 2, 3, 3, 2, 3])

    def test_enrollment_and_unauthorized_operations(self):
        cid = course()
        enrollment = str(uuid.uuid4())
        run(f"INSERT INTO public.course_enrollments(id,course_id,student_id) VALUES('{enrollment}','{cid}','{STUDENT}')", STUDENT)
        self.assertEqual(events(enrollment)[0]['actor_id'], STUDENT)
        self.assertEqual(events(enrollment, A), [])
        material = str(uuid.uuid4())
        run(f"INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{material}','{cid}','Protected','link','https://example.invalid')", I)
        self.assertEqual(len(query(f"SELECT id FROM public.course_materials WHERE id='{material}'", STUDENT)), 1)
        result = run(f"DELETE FROM public.course_materials WHERE course_id='{cid}'", OTHER)
        self.assertEqual(result.returncode, 0)  # RLS hides other owners' rows.
        self.assertEqual(len(query(f"SELECT id FROM public.course_materials WHERE id='{material}'")), 1)
        self.assertEqual(len(events(material)), 1)  # A rejected attempt is not a committed audit event.
        self.assertNotEqual(run(f"INSERT INTO public.course_enrollments(course_id,student_id) VALUES('{cid}','{OTHER}')", A, check=False).returncode, 0)
        # No admin enrollment mutation API exists; authorized system maintenance is still audited.
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE id='{enrollment}'")
        self.assertIn('enrollment_changed', events(enrollment)[1]['actions'])

    def test_required_audit_failure_rolls_back_domain_write(self):
        cid = course()
        try:
            run("CREATE FUNCTION public.fail_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated audit failure'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_audit_test()")
            result = run(f"UPDATE public.courses SET is_published=false WHERE id='{cid}'", I, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(query(f"SELECT is_published FROM public.courses WHERE id='{cid}'")[0]['is_published'])
            self.assertEqual(len(events(cid)), 1)
        finally:
            run('DROP TRIGGER IF EXISTS fail_audit ON public.audit_events; DROP FUNCTION IF EXISTS public.fail_audit_test()')

    def test_notification_failure_preserves_audit_and_retry_is_idempotent(self):
        cid = course(A)
        try:
            run("CREATE FUNCTION public.fail_notification_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'notification unavailable'; END $$; CREATE TRIGGER fail_notification BEFORE INSERT ON public.audit_notifications FOR EACH ROW EXECUTE FUNCTION public.fail_notification_test()")
            run(f"DELETE FROM public.courses WHERE id='{cid}'", A)
            eid = events(cid)[-1]['id']
            self.assertEqual(events(cid)[-1]['sensitivity'], 'critical')
            self.assertEqual(query(f"SELECT * FROM public.audit_notifications WHERE event_id='{eid}'"), [])
        finally:
            run('DROP TRIGGER IF EXISTS fail_notification ON public.audit_notifications; DROP FUNCTION IF EXISTS public.fail_notification_test()')
        run('SELECT public.requeue_audit_notifications()', '', role='service_role')
        run('SELECT public.requeue_audit_notifications()', '', role='service_role')
        self.assertEqual(len(query(f"SELECT * FROM public.audit_notifications WHERE event_id='{eid}'")), 1)

    def test_filters_and_stable_keyset_pagination(self):
        cid = course()
        for published in ('false','true','false'):
            run(f"UPDATE public.courses SET is_published={published} WHERE id='{cid}'", I)
        first = query(f"SELECT * FROM public.search_audit_events(p_actor=>'{I}',p_entity=>'courses',p_action=>'unpublished',p_limit=>1)", A)
        self.assertEqual(len(first), 1)
        cursor = first[0]
        following = query(f"SELECT * FROM public.search_audit_events(p_actor=>'{I}',p_entity=>'courses',p_action=>'unpublished',p_before_time=>'{cursor['occurred_at']}',p_before_id=>'{cursor['id']}',p_limit=>1)", A)
        self.assertEqual(len(following), 1)
        self.assertNotEqual(first[0]['id'], following[0]['id'])
        self.assertTrue(query("SELECT * FROM public.search_audit_events(p_search=>'Tester',p_from=>'2020-01-01',p_to=>'2100-01-01')", A))
        self.assertEqual(query("SELECT * FROM public.search_audit_events(p_from=>'2100-01-01')", A), [])
        self.assertNotEqual(run('SELECT public.search_audit_events(p_limit=>100000)', A, check=False).returncode, 0)

    def test_concurrent_writes_keep_correct_old_new_values(self):
        cid = course()
        with ThreadPoolExecutor(2) as pool:
            list(pool.map(lambda _: run(f"UPDATE public.courses SET is_published=NOT is_published WHERE id='{cid}'", I), range(2)))
        ev = events(cid)
        self.assertEqual(len(ev), 3)
        self.assertEqual(ev[1]['new_values']['is_published'], ev[2]['old_values']['is_published'])
        self.assertTrue(ev[2]['new_values']['is_published'])

    def test_role_change_waits_for_audited_transaction(self):
        cid = course(OTHER)
        holder = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        holder.stdin.write(command(f"UPDATE public.courses SET is_published=false WHERE id='{cid}'; SELECT pg_advisory_xact_lock(222222); SELECT pg_sleep(2)", OTHER))
        holder.stdin.close()
        try:
            deadline = time.monotonic()+8
            while time.monotonic()<deadline:
                if query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=222222 AND granted"):
                    break
                time.sleep(.05)
            else:
                self.fail('Audited transaction did not acquire marker lock')
            # Role update cannot obtain the actor row lock while the audit transaction holds it.
            result = run(f"SET LOCAL lock_timeout='150ms'; SELECT public.admin_set_user_role('{OTHER}','student')", S, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('lock timeout', result.stderr)
            holder.wait(timeout=8)
            self.assertEqual(holder.returncode, 0, holder.stderr.read())
            run(f"SELECT public.admin_set_user_role('{OTHER}','student')", S)
            self.assertEqual(events(cid)[-1]['actor_role'], 'instructor')
            self.assertEqual(events(OTHER)[-1]['actor_role'], 'super_admin')
        finally:
            holder.wait(timeout=10)
            holder.stdout.close(); holder.stderr.close()
            run(f"SELECT public.admin_set_user_role('{OTHER}','instructor')", S)

    def test_owner_accidental_mutation_and_domain_truncate_blocked(self):
        cid = course()
        for statement in ("TRUNCATE public.courses CASCADE", "DELETE FROM public.audit_events", "UPDATE public.audit_events SET actor_name='changed'", "TRUNCATE public.audit_notifications"):
            self.assertNotEqual(run(statement, check=False).returncode, 0)
        self.assertEqual(len(events(cid)), 1)

    def test_reader_role_is_current_not_stale_jwt_metadata(self):
        target = str(uuid.uuid4())
        run(f"INSERT INTO auth.users(id,email) VALUES('{target}','reader@example.invalid')")
        run(f"SELECT public.admin_set_user_role('{target}','admin')", S)
        course()
        self.assertTrue(query("SELECT * FROM public.audit_events", target))
        run(f"SELECT public.admin_set_user_role('{target}','student')", S)
        self.assertEqual(query("SELECT * FROM public.audit_events", target), [])

    def test_role_rpc_still_rejects_privilege_escalation_and_self_changes(self):
        for actor,target,role in ((I,STUDENT,'instructor'),(A,STUDENT,'admin'),(A,S,'student'),(S,S,'student')):
            before = len(events(target))
            self.assertNotEqual(run(f"SELECT public.admin_set_user_role('{target}','{role}')", actor, check=False).returncode, 0)
            self.assertEqual(len(events(target)), before)

    def test_identity_and_timestamp_only_changes_are_audited(self):
        cid, replacement = course(), str(uuid.uuid4())
        run(f"UPDATE public.courses SET id='{replacement}' WHERE id='{cid}'", I)
        renamed = events(replacement, A)
        self.assertEqual(len(renamed), 1, 'Primary-key-only mutation must not bypass audit')
        self.assertEqual(renamed[0]['old_values']['id'], cid)
        self.assertEqual(renamed[0]['new_values']['id'], replacement)
        run(f"UPDATE public.courses SET created_at='2001-01-01Z' WHERE id='{replacement}'", I)
        self.assertIn('created_at', events(replacement)[-1]['new_values'])
        enrollment = str(uuid.uuid4())
        run(f"INSERT INTO public.course_enrollments(id,course_id,student_id) VALUES('{enrollment}','{replacement}','{STUDENT}')", STUDENT)
        run(f"UPDATE public.course_enrollments SET enrolled_at='2002-01-01Z' WHERE id='{enrollment}'")
        self.assertIn('enrolled_at', events(enrollment)[-1]['new_values'])

    def test_free_text_major_is_redacted_at_creation_and_change(self):
        target = str(uuid.uuid4())
        run(f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{target}','privacy@example.invalid','{{\"major\":\"secret-api-key\"}}')")
        run(f"UPDATE public.users SET major='another-private-token' WHERE id='{target}'")
        ev = events(target, S)
        self.assertEqual(len(ev), 2)
        self.assertNotIn('secret-api-key', json.dumps(ev))
        self.assertNotIn('another-private-token', json.dumps(ev))
        self.assertEqual(ev[1]['old_values']['major'], '[REDACTED]')
        self.assertEqual(ev[1]['new_values']['major'], '[REDACTED]')
        self.assertIn('access_changed', ev[1]['actions'])

    def test_question_difficulty_is_free_text_not_a_safe_enum(self):
        cid, qid = course(), str(uuid.uuid4())
        run(f"INSERT INTO public.questions(id,course_id,type,content,correct_answer,difficulty) VALUES('{qid}','{cid}','tf','Private','true','secret-difficulty-token')", I)
        run(f"UPDATE public.questions SET difficulty='other-secret' WHERE id='{qid}'", I)
        ev = events(qid, A)
        self.assertEqual(ev[1]['old_values']['difficulty'], '[REDACTED]')
        self.assertEqual(ev[1]['new_values']['difficulty'], '[REDACTED]')
        self.assertNotIn('secret', json.dumps(ev))

    def test_security_definers_ignore_temp_objects_and_claimed_application_role(self):
        cid = course()
        result = run(f"""CREATE TEMP TABLE users(id uuid,role text);
          INSERT INTO users VALUES('{I}','super_admin');
          CREATE TEMP TABLE audit_events(id uuid);
          SET LOCAL search_path=pg_temp,public;
          SET LOCAL request.jwt.claim.role='super_admin';
          SELECT public.audit_reader_role();
          SELECT count(*) FROM public.search_audit_events();""", I)
        self.assertEqual(result.stdout.strip().splitlines(), ['instructor', '0'])
        self.assertEqual(len(events(cid, A)), 1)
        functions = query("SELECT proname,prosecdef,proconfig FROM pg_proc WHERE pronamespace='yhub_audit_private'::regnamespace OR (pronamespace='public'::regnamespace AND proname IN ('audit_reader_role','search_audit_events','requeue_audit_notifications','admin_set_user_role'))")
        for function in functions:
            self.assertIn('search_path=""', function['proconfig'])
            if function['proname'] == 'search_audit_events':
                self.assertFalse(function['prosecdef'])

    def test_cascade_audit_failure_rolls_back_children_and_notifications(self):
        cid, mid = course(), str(uuid.uuid4())
        run(f"INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{mid}','{cid}','Material','link','https://example.invalid')", I)
        before = len(query('SELECT event_id FROM public.audit_notifications'))
        try:
            run("CREATE FUNCTION public.fail_child_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='DELETE' AND NEW.entity_type='course_materials' THEN RAISE EXCEPTION 'required child audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_child_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_child_audit_test()")
            result = run(f"DELETE FROM public.courses WHERE id='{cid}'", I, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('required child audit unavailable', result.stderr)
            self.assertEqual(len(query(f"SELECT id FROM public.courses WHERE id='{cid}'")), 1)
            self.assertEqual(len(query(f"SELECT id FROM public.course_materials WHERE id='{mid}'")), 1)
            self.assertEqual(len(events(cid)), 1)
            self.assertEqual(len(events(mid)), 1)
            self.assertEqual(len(query('SELECT event_id FROM public.audit_notifications')), before)
        finally:
            run('DROP TRIGGER IF EXISTS fail_child_audit ON public.audit_events; DROP FUNCTION IF EXISTS public.fail_child_audit_test()')

    def test_account_deletion_retains_actor_snapshot_and_system_cascade(self):
        target = str(uuid.uuid4())
        run(f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{target}','gone@example.invalid','{{\"full_name\":\"Retained Actor\"}}')")
        run(f"SELECT public.admin_set_user_role('{target}','instructor')", S)
        cid = course(target)
        run(f"DELETE FROM auth.users WHERE id='{target}'")
        ev = events(cid, S)
        self.assertEqual(ev[0]['actor_id'], target)
        self.assertEqual(ev[0]['actor_name'], 'Retained Actor')
        self.assertEqual(ev[1]['actor_role'], 'system')
        self.assertIsNone(ev[1]['actor_id'])
        self.assertEqual(ev[1]['operation'], 'DELETE')
        self.assertEqual(len(events(cid, A)), 1)
        self.assertEqual(events(target, S)[-1]['operation'], 'DELETE')

    def test_all_domain_columns_have_an_explicit_audit_classification(self):
        # A future schema addition must be deliberately tracked/redacted; no silent gaps.
        rows = query("SELECT c.relname,encode(t.tgargs,'escape') AS args FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='audit_capture'")
        self.assertEqual(len(rows), 8)
        for row in rows:
            tracked = set(row['args'].split('\\000')[0].split(','))
            if row['relname'] == 'users':
                self.assertEqual(tracked, {'id', 'role', 'major'})
                continue
            columns = query(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{row['relname']}'")
            self.assertEqual(tracked, {column['column_name'] for column in columns})

    def test_demotion_committing_before_write_prevents_stale_role_authorization(self):
        cid = course(OTHER)
        holder = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        holder.stdin.write(command(f"SELECT public.admin_set_user_role('{OTHER}','student'); SELECT pg_advisory_xact_lock(333333); SELECT pg_sleep(2)", S))
        holder.stdin.close()
        try:
            deadline = time.monotonic()+8
            while time.monotonic()<deadline:
                if query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=333333 AND granted"):
                    break
                time.sleep(.05)
            else:
                self.fail('Role-changing transaction did not acquire marker lock')
            # Statement starts while its old role is still visible, then waits for actor lock.
            result = run(f"UPDATE public.courses SET is_published=false WHERE id='{cid}'", OTHER, check=False)
            holder.wait(timeout=8)
            self.assertEqual(holder.returncode, 0, holder.stderr.read())
            self.assertTrue(query(f"SELECT is_published FROM public.courses WHERE id='{cid}'")[0]['is_published'])
            self.assertEqual(len(events(cid)), 1)
        finally:
            holder.wait(timeout=10)
            holder.stdout.close(); holder.stderr.close()
            run(f"SELECT public.admin_set_user_role('{OTHER}','instructor')", S)

    def test_demoted_owner_cannot_mutate_academic_content(self):
        target, mid, eid, qid = [str(uuid.uuid4()) for _ in range(4)]
        run(f"INSERT INTO auth.users(id,email) VALUES('{target}','demoted@example.invalid')")
        run(f"SELECT public.admin_set_user_role('{target}','instructor')", S)
        cid = course(target)
        run(f"""INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('{mid}','{cid}','Original','link','https://example.invalid');
          INSERT INTO public.exams(id,course_id,title) VALUES('{eid}','{cid}','Original');
          INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('{qid}','{cid}','{eid}','tf','Original','true');""", target)
        run(f"SELECT public.admin_set_user_role('{target}','student')", S)
        for table, key, field in (('course_materials',mid,'title'), ('exams',eid,'title'), ('questions',qid,'content')):
            with self.subTest(table=table):
                run(f"UPDATE public.{table} SET {field}='Unauthorized' WHERE id='{key}'", target, check=False)
                self.assertEqual(query(f"SELECT {field} AS value FROM public.{table} WHERE id='{key}'")[0]['value'], 'Original')
                run(f"DELETE FROM public.{table} WHERE id='{key}'", target, check=False)
                self.assertEqual(len(query(f"SELECT id FROM public.{table} WHERE id='{key}'")), 1)
                self.assertEqual(len(events(key)), 1)
        for statement in (
            f"INSERT INTO public.course_materials(course_id,title,type,url) VALUES('{cid}','Forged','link','https://example.invalid')",
            f"INSERT INTO public.exams(course_id,title) VALUES('{cid}','Forged')",
            f"INSERT INTO public.questions(course_id,type,content,correct_answer) VALUES('{cid}','tf','Forged','true')",
        ):
            with self.subTest(statement=statement):
                self.assertNotEqual(run(statement, target, check=False).returncode, 0)

    def test_delete_returning_distinguishes_success_from_zero_rows_and_sql_failure(self):
        cid, eid, qid = course(), str(uuid.uuid4()), str(uuid.uuid4())
        run(f"INSERT INTO public.exams(id,course_id,title) VALUES('{eid}','{cid}','Delete result'); INSERT INTO public.questions(id,course_id,type,content,correct_answer) VALUES('{qid}','{cid}','tf','Delete result','true')", I)
        for table, key in (('questions', qid), ('exams', eid)):
            with self.subTest(table=table):
                def deletion(actor, target=key, check=True):
                    return run(f"WITH deleted AS (DELETE FROM public.{table} WHERE id='{target}' RETURNING id) SELECT coalesce(jsonb_agg(id),'[]') FROM deleted", actor, check=check)
                self.assertEqual(json.loads(deletion(OTHER).stdout), [])  # RLS denial is not a SQL error.
                self.assertEqual(json.loads(deletion(I, str(uuid.uuid4())).stdout), [])  # Missing row.
                self.assertEqual(len(events(key)), 1)
                try:
                    run("CREATE FUNCTION public.fail_delete_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated required audit failure'; END $$; CREATE TRIGGER fail_delete_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_delete_audit_test()")
                    failure = deletion(I, check=False)
                    self.assertNotEqual(failure.returncode, 0)
                    self.assertIn('simulated required audit failure', failure.stderr)
                    self.assertEqual(len(query(f"SELECT id FROM public.{table} WHERE id='{key}'")), 1)
                finally:
                    run('DROP TRIGGER IF EXISTS fail_delete_audit ON public.audit_events; DROP FUNCTION IF EXISTS public.fail_delete_audit_test()')
                self.assertEqual(json.loads(deletion(I).stdout), [key])
                self.assertEqual(events(key)[-1]['operation'], 'DELETE')
