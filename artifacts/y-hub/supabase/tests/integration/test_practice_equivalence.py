"""Actual local JWT/PostgREST + deployed engine artifact; no hosted service writes."""
import json
import subprocess
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import test_practice_math as fixtures


class PracticeEquivalenceHTTP(unittest.TestCase):
    setUpClass = classmethod(fixtures.PracticeMathHTTP.setUpClass.__func__)
    setUp = fixtures.PracticeMathHTTP.setUp
    req = fixtures.PracticeMathHTTP.req
    selection = fixtures.PracticeMathHTTP.selection
    create = fixtures.PracticeMathHTTP.create
    worker = fixtures.PracticeMathHTTP.worker
    proposal = fixtures.PracticeMathHTTP.proposal
    read = fixtures.PracticeMathHTTP.read
    computed = fixtures.PracticeMathHTTP.computed

    def variant(self, sid):
        proposal = self.computed(sid)
        task = proposal['p_verification']['task']
        task['coefficients'][0] = 99
        task['variable'] = 't'
        task['options'].reverse()
        module = (Path(__file__).resolve().parents[2] / 'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
        code = 'import {verifyDerivative} from ' + json.dumps(module) + ';process.stdout.write(JSON.stringify(verifyDerivative(' + json.dumps(task) + ',"en")));'
        result = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], text=True, timeout=10))
        return {**proposal, 'p_question': result['question'], 'p_verification': result['verification']}

    def test_equivalence_rejected_over_real_http_with_no_partial_revision(self):
        first, _ = self.create()
        self.assertEqual(self.worker('publish_ai_practice_math_question', self.computed(first))[0], 204)
        second, _ = self.create()
        status, error = self.worker('publish_ai_practice_math_question', self.variant(second))
        self.assertEqual(status, 409)
        self.assertEqual(error['message'], 'Repeated mathematical question; retry generation')
        state = self.read(second)
        self.assertEqual((state['revision'], state['questions']), (1, []))

    def test_same_student_concurrent_devices_have_one_winner(self):
        sessions = [self.create()[0] for _ in range(2)]
        proposals = [self.computed(sessions[0]), self.variant(sessions[1])]
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda p: self.worker('publish_ai_practice_math_question', p), proposals))
        self.assertEqual(sorted(r[0] for r in results), [204, 409])
        self.assertEqual(sum(len(self.read(s)['questions']) for s in sessions), 1)

    def test_explicit_repeat_setting_and_lost_acknowledgement(self):
        first, settings = self.create(target=2)
        self.assertEqual(self.worker('publish_ai_practice_math_question', self.computed(first))[0], 204)
        second = str(uuid.uuid4())
        settings.update(p_id=second, p_allow_repeats=True)
        self.assertEqual(self.req('student', '/rpc/create_ai_practice_session', settings), (200, second))
        proposal = self.variant(second)
        for _ in range(2):
            self.assertEqual(self.worker('publish_ai_practice_math_question', proposal)[0], 204)
        self.assertEqual(self.read(second)['revision'], 2)
        self.assertEqual(self.worker('publish_ai_practice_math_question', {**self.computed(second), 'p_position': 2})[0], 409)

    def test_private_history_helper_not_exposed_to_any_browser_role(self):
        sid, _ = self.create()
        proposal = self.computed(sid)
        self.assertEqual(self.worker('publish_ai_practice_math_question', proposal)[0], 204)
        for role in ['student', 'instructor', 'admin', 'super_admin', 'other', None]:
            self.assertIn(self.req(role, '/rpc/ai_practice_generation_context',
                                   {'p_actor': self.users['student']['id'], 'p_id': sid, 'p_position': 1})[0], [401, 403])
            self.assertIn(self.req(role, '/rpc/derivative_identity', {'p_verification': proposal['p_verification']})[0], [401, 404])
        self.assertIsNone(self.read(sid)['questions'][0]['feedback'])

    def test_section_and_actor_access_checked_before_duplicate_history(self):
        sid, _ = self.create()
        self.assertEqual(self.worker('publish_ai_practice_math_question', self.computed(sid))[0], 204)
        second, _ = self.create()
        proposal = self.variant(second)
        self.assertEqual(self.worker('publish_ai_practice_math_question',
                                     {**proposal, 'p_actor': self.users['other']['id']})[0], 403)
        self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
        self.assertEqual(self.worker('publish_ai_practice_math_question', proposal)[0], 403)
