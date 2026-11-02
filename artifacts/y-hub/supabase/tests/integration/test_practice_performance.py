"""Weighted indicator through real local Auth/JWT, PostgREST and verified math."""
import unittest
from concurrent.futures import ThreadPoolExecutor
import test_practice_adaptive as fixtures

class PerformanceHTTP(unittest.TestCase):
    setUpClass=classmethod(fixtures.AdaptivePracticeHTTP.setUpClass.__func__)
    setUp=fixtures.AdaptivePracticeHTTP.setUp
    req=fixtures.AdaptivePracticeHTTP.req
    selection=fixtures.AdaptivePracticeHTTP.selection
    worker=fixtures.AdaptivePracticeHTTP.worker
    proposal=fixtures.AdaptivePracticeHTTP.proposal
    read=fixtures.AdaptivePracticeHTTP.read
    save=fixtures.AdaptivePracticeHTTP.save
    computed=fixtures.AdaptivePracticeHTTP.computed
    create=fixtures.AdaptivePracticeHTTP.create
    history=fixtures.AdaptivePracticeHTTP.history

    def report(self,role='student'):
        status,data=self.req(role,'/rpc/read_ai_practice_performance',{'p_course':self.course})
        self.assertEqual(status,200,data);return data

    def weights(self,practice=40,revision=0,role='instructor'):
        return self.req(role,'/rpc/set_ai_practice_performance_weights',{'p_course':self.course,'p_revision':revision,'p_practice':practice,'p_exam':100-practice})

    def test_confirmed_performance_withholds_self_tests_and_uses_course_weights(self):
        self.history();self.assertEqual(self.report()['summary']['score'],100)
        sid=self.create('medium');self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],204)
        self.save(sid,self.read(sid)['revision'],1,True)
        self.assertEqual(self.report()['summary']['practice']['graded'],6)
        self.assertEqual(self.weights(30),(200,1))
        exam=self.history('exam');self.assertEqual(self.report()['summary']['coverage'],30)
        self.assertEqual(self.req('student','/rpc/submit_ai_practice_session',{'p_id':exam,'p_revision':self.read(exam)['revision']})[0],200)
        result=self.report()['summary'];self.assertEqual(result['score'],95);self.assertEqual(result['coverage'],100)

    def test_current_roles_cannot_read_foreign_scores_or_forge_weights(self):
        self.history()
        for role in ['other','admin','super_admin',None]:
            self.assertIn(self.req(role,'/rpc/read_ai_practice_performance',{'p_course':self.course})[0],[401,403])
        self.assertIsNone(self.report('instructor')['summary']['score'])
        for role in ['student','other','admin','super_admin',None]:self.assertIn(self.weights(role=role)[0],[401,403])
        for role in ['student','instructor','admin','super_admin']:
            for method,body in [('POST',{'course_id':self.course,'practice_weight':100,'exam_weight':0}),('PATCH',{'practice_weight':100}),('DELETE',None)]:
                self.assertEqual(self.req(role,'/ai_practice_performance_weights',body,method)[0],403)
        self.assertEqual(self.req('student','/rpc/read_ai_practice_performance',{'p_course':self.course,'p_actor':self.users['instructor']['id']})[0],404)

    def test_native_conflict_and_lost_ack_are_idempotent_with_one_audit_per_change(self):
        with ThreadPoolExecutor(2) as pool:replies=list(pool.map(lambda n:self.weights(n),[30,70]))
        self.assertEqual(sorted(r[0] for r in replies),[200,409])
        current=self.report()['weights']['practice'];self.assertEqual(self.weights(current),(200,1))
        self.assertEqual(self.stack.sql(f"SELECT count(*) FROM public.audit_events WHERE entity_type='ai_practice_performance_weights' AND context->>'course_id'='{self.course}'"),'1')

    def test_withdrawal_and_demoted_instructor_invalidate_old_jwts(self):
        self.history();self.weights()
        self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
        self.assertEqual(self.req('student','/rpc/read_ai_practice_performance',{'p_course':self.course})[0],403)
        actor=self.users['instructor']['id'];self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{actor}'")
        try:self.assertEqual(self.weights(60,1)[0],403)
        finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{actor}'")

    def test_review_and_source_changes_recompute_without_a_stale_grade_cache(self):
        prior=self.history();self.assertEqual(self.report()['summary']['practice']['graded'],5)
        self.assertEqual(self.req('student','/rpc/begin_ai_practice_review',{'p_session':prior,'p_position':1})[0],200)
        self.assertEqual(self.report()['summary']['practice']['graded'],4)
        self.assertEqual(self.report()['summary']['practice']['pending'],1)
        self.stack.sql(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{self.source}'")
        result=self.report();self.assertIsNone(result['summary']['score']);self.assertEqual(result['unavailableSessions'],1)
