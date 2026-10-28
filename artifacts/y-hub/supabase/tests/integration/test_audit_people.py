"""Real local GoTrue JWT -> PostgREST -> audit RLS, no mock authorization."""
import json
import unittest
import uuid
from pathlib import Path
from runtime import Stack


class AuditPeopleHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stack = Stack(Path.cwd())
        cls.addClassCleanup(cls.stack.close)
        cls.stack.start()
        cls.accounts = {}
        for role in ('student', 'instructor', 'admin', 'super_admin'):
            status, data = cls.stack.request('auth', '/signup', {
                'email': f'{uuid.uuid4()}@audit.invalid', 'password': 'Local-audit-test-123!',
                'data': {'full_name_ar': 'هوية تدقيق', 'full_name_en': 'Audit Identity', 'major': 'mathematics'},
            })
            if status != 200: raise AssertionError(f'Local signup failed: {status}')
            uid = data['user']['id']
            cls.accounts[role] = (uid, data['access_token'])
            if role != 'student': cls.stack.sql(f"UPDATE public.users SET role='{role}' WHERE id='{uid}'")

    def request(self, role, path, data=None, method=None):
        return self.stack.request('rest', path, data, self.accounts[role][1] if role else None, method)

    def ok(self, role, path, data=None, method=None):
        status, body = self.request(role, path, data, method)
        self.assertLess(status, 300, f'{status}: {body}')
        return body

    def course(self):
        cid = str(uuid.uuid4())
        self.ok('instructor', '/courses', {'id': cid, 'instructor_id': self.accounts['instructor'][0], 'title': 'Private academic content'})
        return cid

    def test_actor_number_suggestions_and_count_through_real_jwt(self):
        cid = self.course()
        uid = self.accounts['instructor'][0]
        number = self.stack.sql(f"SELECT user_number FROM public.users WHERE id='{uid}'")
        people = self.ok('admin', '/rpc/suggest_audit_people', {'p_search': number, 'p_scope': 'actor'})
        self.assertEqual([p['person_id'] for p in people], [uid])
        self.assertEqual(people[0]['full_name_ar'], 'هوية تدقيق')
        result = self.ok('admin', '/rpc/search_audit_events_v2', {'p_actor': uid, 'p_person_scope': 'actor', 'p_person_search': 'obsolete name', 'p_limit': 1})
        self.assertGreaterEqual(result['total'], 1)
        self.assertEqual(len(result['events']), 1)
        self.assertEqual(result['events'][0]['entity_id'], cid)
        self.assertEqual(result['events'][0]['people'][0]['user_number'], number)
        self.assertNotIn('Private academic content', json.dumps(result))

    def test_admin_cannot_discover_owner_only_affected_person(self):
        uid = self.accounts['student'][0]
        number = self.stack.sql(f"SELECT user_number FROM public.users WHERE id='{uid}'")
        params = {'p_person_search': number, 'p_person_scope': 'affected'}
        self.assertEqual(self.ok('admin', '/rpc/search_audit_events_v2', params), {'events': [], 'total': 0})
        self.assertEqual(self.ok('admin', '/rpc/suggest_audit_people', {'p_search': number}), [])
        self.assertEqual(self.ok('admin', f'/audit_event_people?person_id=eq.{uid}'), [])
        self.assertGreater(self.ok('super_admin', '/rpc/search_audit_events_v2', params)['total'], 0)

    def test_all_app_roles_cannot_forge_or_mutate_identity_history(self):
        self.course()
        eid = self.stack.sql('SELECT id FROM public.audit_events ORDER BY occurred_at DESC LIMIT 1')
        for role in self.accounts:
            for data, method in [({'event_id': eid}, 'POST'), ({'full_name': 'Forged'}, 'PATCH'), (None, 'DELETE')]:
                status, _ = self.request(role, f'/audit_event_people?event_id=eq.{eid}', data, method)
                self.assertIn(status, (401, 403))
            status, _ = self.request(role, '/rpc/record_people', {'p_event': eid})
            self.assertIn(status, (403, 404))

    def test_unprivileged_and_invalid_tokens_cannot_read_search_rpc(self):
        for role in ('student', 'instructor', None):
            for rpc, data in [('search_audit_events_v2', {}), ('suggest_audit_people', {'p_search': 'Audit'})]:
                status, _ = self.request(role, '/rpc/' + rpc, data)
                self.assertIn(status, (401, 403))
        status, _ = self.stack.request('rest', '/rpc/search_audit_events_v2', {}, 'invalid.jwt.signature')
        self.assertEqual(status, 401)

    def test_same_jwt_loses_read_access_after_demotion(self):
        uid = self.accounts['admin'][0]
        try:
            self.ok('super_admin', '/rpc/admin_set_user_role', {'p_user_id': uid, 'p_new_role': 'student'})
            status, _ = self.request('admin', '/rpc/search_audit_events_v2', {})
            self.assertEqual(status, 403)
            self.assertEqual(self.ok('admin', '/audit_event_people'), [])
        finally:
            self.ok('super_admin', '/rpc/admin_set_user_role', {'p_user_id': uid, 'p_new_role': 'admin'})
