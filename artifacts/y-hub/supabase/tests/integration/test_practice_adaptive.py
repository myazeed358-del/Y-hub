"""Adaptive planning over native local Auth/JWT/PostgREST and the real math artifact."""
import json
import subprocess
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import test_practice_math as fixtures


class AdaptivePracticeHTTP(unittest.TestCase):
    setUpClass = classmethod(fixtures.PracticeMathHTTP.setUpClass.__func__)
    setUp = fixtures.PracticeMathHTTP.setUp
    req = fixtures.PracticeMathHTTP.req
    selection = fixtures.PracticeMathHTTP.selection
    worker = fixtures.PracticeMathHTTP.worker
    proposal = fixtures.PracticeMathHTTP.proposal
    read = fixtures.PracticeMathHTTP.read
    save = fixtures.PracticeMathHTTP.save
    computed = fixtures.PracticeMathHTTP.computed

    def create(self, difficulty='adaptive', target=1, mode='practice', selection=None):
        sid = str(uuid.uuid4())
        args = {**(selection or self.selection()), 'p_id': sid, 'p_units': [],
                'p_query': '', 'p_mode': mode, 'p_difficulty': difficulty,
                'p_language': 'ar', 'p_target': target, 'p_allow_repeats': True}
        self.assertEqual(self.req('student', '/rpc/create_ai_practice_session', args), (200, sid))
        return sid

    def context(self, sid, position=1):
        return self.worker('ai_practice_generation_context', {
            'p_actor': self.users['student']['id'], 'p_id': sid, 'p_position': position})

    def history(self, mode='practice'):
        sid = self.create('medium', 5, mode)
        module = (Path(__file__).resolve().parents[2] / 'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
        code = ('import {verifyDerivative} from ' + json.dumps(module) +
                ";process.stdout.write(JSON.stringify(Array.from({length:5},(_,k)=>verifyDerivative({kind:'polynomial_derivative',variable:'x',coefficients:[0,k,1],options:[[k,2],[0],[1],[2]]},'ar'))));")
        questions = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], text=True, timeout=10))
        for position, q in enumerate(questions, 1):
            args = {**self.proposal(sid), 'p_position': position, 'p_question': q['question'], 'p_verification': q['verification']}
            self.assertEqual(self.worker('publish_ai_practice_math_question', args)[0], 204)
            self.assertEqual(self.req('student', '/rpc/save_ai_practice_answer', {
                'p_id': sid, 'p_position': position, 'p_revision': self.read(sid)['revision'],
                'p_choice': 0, 'p_answer': True})[0], 200)
        return sid

    def test_trusted_results_plan_level_and_keep_feedback_private(self):
        self.history()
        sid = self.create(); status, config = self.context(sid)
        self.assertEqual(status, 200); self.assertEqual(config['difficulty'], 'hard')
        args = self.computed(sid)
        self.assertEqual(self.worker('publish_ai_practice_math_question', args)[0], 204)
        q = self.read(sid)['questions'][0]
        self.assertEqual(q['generation'], {'difficulty': 'hard', 'reason': 'stretch', 'samples': 5})
        self.assertIsNone(q['feedback'])
        self.assertEqual(self.worker('publish_ai_practice_math_question', args)[0], 204)
        self.assertEqual(self.read(sid)['revision'], 2)

    def test_native_roles_cannot_forge_plans_or_read_another_students_history(self):
        sid = self.create(); args = {'p_actor': self.users['student']['id'], 'p_id': sid, 'p_position': 1}
        for role in ['student', 'instructor', 'admin', 'super_admin', 'other', None]:
            self.assertIn(self.req(role, '/rpc/ai_practice_generation_context', args)[0], [401, 403])
            self.assertEqual(self.stack.request('rest', '/generation_plans', token=self.users[role]['token'] if role else None, profile='practice_private')[0], 406)
        for role in ['other', 'instructor', 'admin', 'super_admin']:
            self.assertEqual(self.req(role, '/rpc/read_ai_practice_session', {'p_id': sid})[0], 403)
        self.assertEqual(self.worker('publish_ai_practice_math_question', self.computed(sid))[0], 409)
        self.assertEqual(self.read(sid)['questions'], [])

    def test_race_and_lost_ack_reuse_frozen_plan(self):
        sid = self.create()
        with ThreadPoolExecutor(2) as pool:
            replies = list(pool.map(lambda _: self.context(sid), range(2)))
        self.assertEqual(replies[0], replies[1]); self.assertEqual(replies[0][0], 200)
        self.history()
        self.assertEqual(self.context(sid)[1]['difficulty'], 'medium')
        self.assertEqual(self.read(sid)['revision'], 1)
        self.assertEqual(self.context(self.create())[1]['difficulty'], 'hard')

    def test_unsubmitted_exam_and_different_page_never_influence_plan(self):
        prior = self.history('exam')
        self.assertEqual(self.context(self.create())[1]['difficulty'], 'medium')
        self.assertEqual(self.req('student', '/rpc/submit_ai_practice_session', {
            'p_id': prior, 'p_revision': self.read(prior)['revision']})[0], 200)
        self.assertEqual(self.context(self.create())[1]['difficulty'], 'hard')
        other_page = self.selection(); other_page['p_selection'][0]['pages'] = [4]
        self.assertEqual(self.context(self.create(selection=other_page))[1]['difficulty'], 'medium')

    def test_withdrawal_invalidates_reserved_plan_and_expired_jwt_is_denied(self):
        sid = self.create(); self.assertEqual(self.context(sid)[0], 200)
        self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
        self.assertEqual(self.context(sid)[0], 403)
        self.assertEqual(self.worker('publish_ai_practice_math_question', self.computed(sid))[0], 403)
        self.assertEqual(self.req('student', '/rpc/read_ai_practice_session', {'p_id': sid})[0], 403)
        # Locally signed expired JWT with the real Auth subject, not a forged signature.
        token = self.users['student']['token'].split('.')
        import base64, hashlib, hmac
        payload = json.loads(base64.urlsafe_b64decode(token[1] + '=' * (-len(token[1]) % 4)))
        payload['exp'] = 1
        token[1] = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
        token[2] = base64.urlsafe_b64encode(hmac.new(self.stack.secret.encode(), (token[0]+'.'+token[1]).encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
        self.assertEqual(self.stack.request('rest', '/rpc/read_ai_practice_session', {'p_id': sid}, '.'.join(token))[0], 401)
