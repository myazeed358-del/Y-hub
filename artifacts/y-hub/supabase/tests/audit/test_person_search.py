"""Decision24: isolated PostgreSQL identity snapshots, invoker RPCs and RLS."""
import json
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from test_audit import run, query, course, events, I, A, S, STUDENT


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def search(actor=S, **params):
    args = ','.join(f'{key}=>{literal(value)}' for key, value in params.items())
    return query(f'SELECT public.search_audit_events_v2({args}) result', actor)[0]['result']


def suggest(value, actor=S, scope='either'):
    return query(f'SELECT public.suggest_audit_people({literal(value)},{literal(scope)}) result', actor)[0]['result']


def person():
    uid = str(uuid.uuid4())
    run(f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{uid}','{uid}@example.invalid',jsonb_build_object('full_name_ar','أحمد التجريبي','full_name_en','Ahmad Test'))")
    return uid, query(f"SELECT user_number FROM public.users WHERE id='{uid}'")[0]['user_number']


class AuditPeopleTests(unittest.TestCase):
    def test_actor_affected_and_either_with_number_and_name(self):
        cid = course()
        eid = events(cid)[0]['id']
        number = query(f"SELECT user_number FROM public.users WHERE id='{I}'")[0]['user_number']
        for scope in ('actor', 'affected', 'either'):
            result = search(A, p_person_search=number, p_person_scope=scope)
            self.assertIn(eid, [e['id'] for e in result['events']])
            self.assertEqual(result['total'], len(query(f"SELECT DISTINCT e.id FROM public.audit_events e JOIN public.audit_event_people p ON p.event_id=e.id WHERE p.user_number='{number}' AND ('{scope}'='either' OR p.relation='{scope}')", A)))
        entry = next(e for e in search(A, p_person_search='Audit Tester 1')['events'] if e['id'] == eid)
        self.assertEqual({p['relation'] for p in entry['people']}, {'actor', 'affected'})
        self.assertTrue(all(p['recorded'] and p['user_number'] == number for p in entry['people']))
        self.assertNotIn('search_document', entry)
        self.assertNotIn('transaction_id', entry)

    def test_localized_suggestions_selected_id_and_no_open_directory(self):
        uid, number = person()
        for name in ('أحمد', 'ahmad', number):
            self.assertIn(uid, [p['person_id'] for p in suggest(name)])
        self.assertEqual(suggest(number, A), [])  # system signup is Owner-only
        self.assertEqual(suggest('%'), [])  # not a wildcard
        self.assertEqual(suggest('a'), [])
        result = search(p_actor=uid, p_person_search='obsolete display name', p_person_scope='affected')
        self.assertEqual(result['total'], 1)  # selected identity overrides stale label
        self.assertEqual(search(p_actor=uid, p_person_scope='actor')['total'], 0)

    def test_unchanged_enrollment_identity_is_captured_from_full_row(self):
        uid, number = person()
        cid = course()
        enrollment = str(uuid.uuid4())
        run(f"INSERT INTO public.course_enrollments(id,course_id,student_id) VALUES('{enrollment}','{cid}','{uid}')", uid)
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE id='{enrollment}'")
        ev = events(enrollment)[-1]
        self.assertNotIn('student_id', ev['new_values'])
        self.assertIn(ev['id'], [e['id'] for e in search(p_person_search=number, p_person_scope='affected')['events']])
        self.assertEqual(search(A, p_person_search=number)['total'], 0)

    def test_old_and_new_assignees_are_affected_without_duplicate_events(self):
        cid = course()
        old_count = len(events(cid))
        run(f"UPDATE public.courses SET instructor_id='{A}' WHERE id='{cid}'")
        ev = events(cid)[-1]
        people = query(f"SELECT * FROM public.audit_event_people WHERE event_id='{ev['id']}'")
        self.assertEqual({p['person_id'] for p in people}, {I, A})
        self.assertTrue(all(p['relation'] == 'affected' for p in people))
        self.assertEqual(len(events(cid)), old_count + 1)

    def test_rpc_table_counts_and_suggestions_share_reader_isolation(self):
        uid, number = person()
        run(f"SELECT public.admin_set_user_role('{uid}','instructor')", A)
        self.assertEqual(search(A, p_actor=uid)['total'], 0)
        self.assertEqual(suggest(number, A), [])
        self.assertEqual(query(f"SELECT * FROM public.audit_event_people WHERE person_id='{uid}'", A), [])
        self.assertEqual(search(S, p_actor=uid)['total'], 2)
        self.assertEqual(len(suggest(number, S)), 1)
        for actor in (I, STUDENT):
            for rpc in ('search_audit_events_v2()', "suggest_audit_people('Audit')"):
                self.assertNotEqual(run(f'SELECT public.{rpc}', actor, check=False).returncode, 0)
            self.assertEqual(query('SELECT * FROM public.audit_event_people', actor), [])
        self.assertNotEqual(run('SELECT public.search_audit_events_v2()', '', role='anon', check=False).returncode, 0)

    def test_companions_cannot_be_forged_changed_or_deleted(self):
        eid = events(course())[0]['id']
        for actor in (I, A, S, STUDENT):
            for sql in (
                'INSERT INTO public.audit_event_people DEFAULT VALUES',
                f"UPDATE public.audit_event_people SET full_name='Forged' WHERE event_id='{eid}'",
                f"DELETE FROM public.audit_event_people WHERE event_id='{eid}'",
                'TRUNCATE public.audit_event_people',
                f"SELECT yhub_audit_private.record_people('{eid}','{{}}','{{}}',true)",
            ):
                with self.subTest(actor=actor, sql=sql):
                    result = run(sql, actor, check=False)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('permission denied', result.stderr)
        self.assertNotEqual(run('DELETE FROM public.audit_event_people', check=False).returncode, 0)

    def test_required_identity_failure_rolls_back_domain_and_event(self):
        cid = course()
        before = len(events(cid))
        try:
            run("CREATE FUNCTION public.fail_people_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'identity capture unavailable'; END $$; CREATE TRIGGER fail_people BEFORE INSERT ON public.audit_event_people FOR EACH ROW EXECUTE FUNCTION public.fail_people_test()")
            result = run(f"UPDATE public.courses SET is_published=false WHERE id='{cid}'", I, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('identity capture unavailable', result.stderr)
            self.assertTrue(query(f"SELECT is_published FROM public.courses WHERE id='{cid}'")[0]['is_published'])
            self.assertEqual(len(events(cid)), before)
        finally:
            run('DROP TRIGGER fail_people ON public.audit_event_people; DROP FUNCTION public.fail_people_test()')

    def test_deleted_account_retains_identity_without_sensitive_fields(self):
        uid, number = person()
        run(f"DELETE FROM auth.users WHERE id='{uid}'")
        result = search(p_person_search=number, p_person_scope='affected')
        self.assertEqual(result['total'], 2)
        identity = result['events'][0]['people'][0]
        self.assertEqual(identity['full_name_ar'], 'أحمد التجريبي')
        self.assertEqual(identity['full_name_en'], 'Ahmad Test')
        self.assertEqual(identity['user_number'], number)
        self.assertNotIn('email', json.dumps(result))
        self.assertNotIn('phone', json.dumps(result))
        self.assertTrue(identity['recorded'])

    def test_pagination_count_and_literal_filter(self):
        cid = course()
        for value in ('false', 'true', 'false'):
            run(f"UPDATE public.courses SET is_published={value} WHERE id='{cid}'", I)
        first = search(A, p_person_search='Audit Tester 1', p_limit=2)
        last = first['events'][-1]
        second = search(A, p_person_search='Audit Tester 1', p_limit=2, p_before_time=last['occurred_at'], p_before_id=last['id'])
        self.assertEqual(first['total'], second['total'])
        self.assertEqual(len(first['events']), 2)
        self.assertFalse({e['id'] for e in first['events']} & {e['id'] for e in second['events']})
        self.assertEqual(search(A, p_person_search='%%')['total'], 0)

    def test_invalid_filters_fail_closed(self):
        for args in ("p_person_scope=>'all'", "p_person_scope=>NULL", "p_person_search=>repeat('x',121)", "p_limit=>102", "p_before_id=>'00000000-0000-0000-0000-000000000001'", "p_from=>'2026-02-01',p_to=>'2026-01-01'"):
            self.assertNotEqual(run(f'SELECT public.search_audit_events_v2({args})', S, check=False).returncode, 0)
        for args in ("p_search=>'test',p_limit=>21", "p_search=>NULL", "p_search=>'test',p_scope=>'bad'"):
            self.assertNotEqual(run(f'SELECT public.suggest_audit_people({args})', S, check=False).returncode, 0)

    def test_role_withdrawal_does_not_trust_old_claims(self):
        uid, _ = person()
        run(f"SELECT public.admin_set_user_role('{uid}','admin')", S)
        self.assertGreaterEqual(search(uid)['total'], 0)
        run(f"SELECT public.admin_set_user_role('{uid}','student')", S)
        self.assertNotEqual(run('SELECT public.search_audit_events_v2()', uid, check=False).returncode, 0)
        self.assertEqual(query('SELECT * FROM public.audit_event_people', uid), [])

    def test_concurrent_domain_changes_capture_one_identity_set_per_event(self):
        cid = course()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda title: run(f"UPDATE public.courses SET title='{title}' WHERE id='{cid}'", I), ('First update', 'Second update')))
        self.assertTrue(all(r.returncode == 0 for r in results))
        self.assertEqual(len(events(cid)), 3)
        for ev in events(cid):
            people = query(f"SELECT * FROM public.audit_event_people WHERE event_id='{ev['id']}'")
            self.assertEqual(len(people), 2)
            self.assertTrue(all(p['person_id'] == I for p in people))

    def test_legacy_backfill_retains_events_and_marks_unknown_historical_identity(self):
        uid = '45000000-0000-4000-8000-000000000001'
        original = events(uid)
        self.assertEqual(len(original), 2)
        identities = query(f"SELECT * FROM public.audit_event_people WHERE person_id='{uid}'")
        self.assertEqual(len(identities), 2)
        for identity in identities:
            self.assertFalse(identity['recorded'])
            self.assertEqual(identity['full_name'], '')  # no invented name from redacted deltas
            self.assertIsNone(identity['full_name_ar'])
            self.assertRegex(identity['user_number'], r'^\d{9}$')  # retained immutable ledger
        self.assertEqual(search(p_person_search=identities[0]['user_number'])['total'], 2)
        self.assertEqual(events(uid), original)
