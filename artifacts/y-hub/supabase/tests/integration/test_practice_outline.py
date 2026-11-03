"""Chapter scopes through native local Auth/JWT/PostgREST and the real math artifact."""
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
import test_practice_math as fixtures

class OutlineHTTP(unittest.TestCase):
    setUpClass=classmethod(fixtures.PracticeMathHTTP.setUpClass.__func__)
    setUp=fixtures.PracticeMathHTTP.setUp
    req=fixtures.PracticeMathHTTP.req
    worker=fixtures.PracticeMathHTTP.worker
    proposal=fixtures.PracticeMathHTTP.proposal
    read=fixtures.PracticeMathHTTP.read
    save=fixtures.PracticeMathHTTP.save
    computed=fixtures.PracticeMathHTTP.computed
    create=fixtures.PracticeMathHTTP.create

    def mapping(self,title='فصل التفاضل',revision=0):
        return {'p_source':self.source,'p_source_revision':self.revision,'p_revision':revision,'p_sections':[{'id':self.source,'kind':'chapter','title':title,'parentId':None,'pages':[2]}]}
    def selection(self):
        return {'p_course':self.course,'p_selection':[{'sourceId':self.source,'revision':self.revision,'pages':[],'outline':{'revision':1,'ids':[self.source]}}]}
    def test_server_expands_pages_and_releases_only_stored_teacher_names(self):
        self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',self.mapping()),(200,1))
        args=self.selection();status,data=self.req('student','/rpc/preview_ai_practice_sources',args)
        self.assertEqual(status,200,data);self.assertEqual({e['page'] for e in data['evidence']},{2})
        sid,_=self.create();self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],204)
        self.assertIsNone(self.read(sid)['questions'][0]['feedback']);self.save(sid,self.read(sid)['revision'],0,True)
        feedback=self.read(sid)['questions'][0]['feedback'];self.assertEqual(feedback['verification'],'polynomial-derivative-v1')
        self.assertEqual(feedback['citations'][0]['outline'],[{'id':self.source,'kind':'chapter','title':'فصل التفاضل'}])
        args['p_selection'][0]['pages']=[2,4];self.assertEqual(self.req('student','/rpc/preview_ai_practice_sources',args)[0],400)
        args['p_selection'][0]['outline']['ids']=[str(uuid.uuid4())];self.assertEqual(self.req('student','/rpc/preview_ai_practice_sources',args)[0],409)

    def test_roles_cannot_forge_outlines_or_read_another_sections_names(self):
        self.req('instructor','/rpc/set_ai_practice_outline',self.mapping())
        for role in ['student','other','admin','super_admin',None]:self.assertIn(self.req(role,'/rpc/set_ai_practice_outline',self.mapping())[0],[401,403])
        for role in ['other','admin','super_admin',None]:self.assertIn(self.req(role,'/rpc/get_ai_practice_outline',{'p_source':self.source})[0],[401,403])
        for role in ['student','instructor','admin','super_admin']:
            for method,body in [('GET',None),('POST',{'id':self.source}),('PATCH',{'revision':99}),('DELETE',None)]:
                self.assertEqual(self.req(role,'/ai_practice_outlines',body,method)[0],403)
        self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',{**self.mapping(),'p_actor':self.users['super_admin']['id']})[0],404)

    def test_cas_conflicts_and_uncertain_ack_retry_have_one_redacted_event(self):
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda title:self.req('instructor','/rpc/set_ai_practice_outline',self.mapping(title)),['First','Second']))
        self.assertEqual(sorted(r[0] for r in results),[200,409])
        status,data=self.req('instructor','/rpc/get_ai_practice_outline',{'p_source':self.source});self.assertEqual(status,200)
        retry=self.mapping();retry['p_sections']=data['sections'];self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',retry),(200,1))
        self.assertEqual(self.stack.sql(f"SELECT count(*) FROM public.audit_events WHERE entity_type='ai_practice_outlines' AND entity_id='{self.source}'"),'1')
        self.assertEqual(self.stack.sql(f"SELECT new_values->>'sections' FROM public.audit_events WHERE entity_type='ai_practice_outlines' AND entity_id='{self.source}'"),'[REDACTED]')

    def test_outline_change_blocks_old_question_context_and_session_using_same_jwt(self):
        self.req('instructor','/rpc/set_ai_practice_outline',self.mapping());sid,_=self.create()
        self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',self.mapping('Changed',1)),(200,2))
        self.assertEqual(self.req('student','/rpc/read_ai_practice_session',{'p_id':sid})[0],409)
        self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],409)
        self.assertEqual(self.req('student','/rpc/preview_ai_practice_sources',self.selection())[0],409)

    def test_revocation_demotion_and_reindex_are_rechecked_server_side(self):
        self.req('instructor','/rpc/set_ai_practice_outline',self.mapping());sid,_=self.create()
        self.stack.sql(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{self.course}'")
        self.assertEqual(self.req('student','/rpc/get_ai_practice_outline',{'p_source':self.source})[0],403)
        self.assertEqual(self.worker('publish_ai_practice_math_question',self.computed(sid))[0],403)
        actor=self.users['instructor']['id'];self.stack.sql(f"UPDATE public.users SET role='student' WHERE id='{actor}'")
        try:self.assertEqual(self.req('instructor','/rpc/set_ai_practice_outline',self.mapping('Changed',1))[0],403)
        finally:self.stack.sql(f"UPDATE public.users SET role='instructor' WHERE id='{actor}'")
        self.stack.sql(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{self.source}'")
        status,data=self.req('instructor','/rpc/get_ai_practice_outline',{'p_source':self.source});self.assertEqual(status,200);self.assertTrue(data['stale']);self.assertEqual(data['sections'],[])
