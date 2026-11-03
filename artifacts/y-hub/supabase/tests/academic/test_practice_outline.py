"""Instructor chapter mapping, server expansion and immutable private citations."""
import json
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,I,A,S,O
from test_practice_sources import setup,source,literal,preview
from test_practice_sessions import create,publish,read,save
from test_practice_adaptive import context
from test_practice_performance import report


def section(kind='chapter',pages=None,parent=None,title='Approved chapter'):
    return {'id':str(uuid.uuid4()),'kind':kind,'title':title,'pages':pages or [2,4],'parentId':parent}
def write(p,sections,revision=0,actor=I,check=True):
    return run(f"SELECT public.set_ai_practice_outline('{p['sourceId']}','{p['revision']}',{revision},{literal(sections)})",actor,check)
def outline(p,actor=U,check=True):
    r=run(f"SELECT public.get_ai_practice_outline('{p['sourceId']}')",actor,check)
    return json.loads(r.stdout) if check else r
def pick(p,ids,revision=1,pages=None):return {**p,'outline':{'revision':revision,'ids':ids},'pages':pages or []}
def session(c,p,mode='practice'):
    return create(c,p,mode=mode,target=1)


class PracticeOutline(unittest.TestCase):
    def test_new_outline_is_empty_until_authorized_instructor_defines_indexed_pages(self):
        c,p=setup();self.assertEqual(outline(p)['sections'],[]);self.assertEqual(outline(p)['revision'],0)
        chapter=section(pages=[4,2],title='  فصل التفاضل  ');write(p,[chapter])
        result=outline(p);self.assertFalse(result['canManage']);self.assertEqual(result['sections'][0]['pages'],[2,4]);self.assertEqual(result['sections'][0]['title'],'فصل التفاضل')
        self.assertTrue(outline(p,I)['canManage'])

    def test_outline_validation_rejects_invented_pages_cycles_and_foreign_parents(self):
        c,p=setup();chapter=section();topic=section('topic',[2],chapter['id'])
        bad=[[{**chapter,'pages':[3]}],[{**chapter,'pages':[2,2]}],[{**chapter,'pages':[]}],[{**chapter,'pages':['2']}],[{**chapter,'title':''}],[{**chapter,'text':'forged'}],[chapter,chapter],[{**chapter,'parentId':topic['id']},topic],[{**topic,'parentId':str(uuid.uuid4())}],[{**chapter,'pages':[2]},{**topic,'pages':[4]}]]
        for rows in bad:self.assertNotEqual(write(p,rows,check=False).returncode,0)
        self.assertEqual(outline(p)['revision'],0)
        write(p,[chapter,topic])
        self.assertNotEqual(write(p,[section() for _ in range(51)],1,check=False).returncode,0)

    def test_server_expands_multiple_sections_and_rejects_client_metadata_or_pages(self):
        c,p=setup();a,b=section(pages=[2]),section('topic',[4]);write(p,[a,b])
        chosen=pick(p,[a['id'],b['id']]);result=json.loads(preview(c,[chosen]).stdout)
        self.assertEqual({e['page'] for e in result['evidence']},{2,4})
        sid=session(c,chosen);stored=json.loads(value(f"SELECT selection FROM public.ai_practice_sessions WHERE id='{sid}'"))
        self.assertEqual(stored[0]['pages'],[2,4]);self.assertEqual(stored[0]['outline']['ids'],sorted([a['id'],b['id']]))
        for changed in [{**pick(p,[a['id']]),'pages':[2,4]},{**chosen,'outline':{'revision':1,'ids':[a['id']],'title':'forged'}},pick(p,[str(uuid.uuid4())]),pick(p,[a['id'],a['id']]),pick(p,[a['id']],2)]:
            self.assertNotEqual(preview(c,[changed],check=False).returncode,0)

    def test_section_ids_cannot_cross_sources_or_courses(self):
        c,p=setup();q=source(c);other,other_source=setup();a=section();write(p,[a])
        for chosen in [pick(q,[a['id']]),pick(other_source,[a['id']])]:self.assertNotEqual(preview(c,[chosen],check=False).returncode,0)
        for actor in [O,A,S]:self.assertNotEqual(outline(p,actor,False).returncode,0)

    def test_current_role_and_owner_assignment_are_required_for_writes(self):
        c,p=setup();a=section()
        for actor in [U,O,A,S]:self.assertNotEqual(write(p,[a],actor=actor,check=False).returncode,0)
        run(f"SELECT public.admin_set_user_role('{I}','student')",S)
        try:self.assertNotEqual(write(p,[a],check=False).returncode,0)
        finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)
        run(f"UPDATE public.courses SET instructor_id='{A}' WHERE id='{c}'")
        self.assertNotEqual(write(p,[a],check=False).returncode,0);self.assertEqual(write(p,[a],actor=A).returncode,0)

    def test_no_browser_or_worker_direct_table_helper_or_forged_event_access(self):
        c,p=setup();write(p,[section()])
        for actor in [U,I,A,S,O]:
            for sql in ['SELECT * FROM public.ai_practice_outlines','INSERT INTO public.ai_practice_outlines DEFAULT VALUES','UPDATE public.ai_practice_outlines SET revision=99','DELETE FROM public.ai_practice_outlines',f"SELECT practice_private.outline_pages('{p['sourceId']}','{p['revision']}',1,'{{}}')"]:
                self.assertNotEqual(run(sql,actor,False).returncode,0)
        for role in ['anon','service_role']:self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.get_ai_practice_outline('{p['sourceId']}')",check=False).returncode,0)

    def test_cas_concurrency_idempotency_and_redacted_audit(self):
        c,p=setup();a=section(title='PRIVATE TITLE');b=section(title='Other title')
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda s:write(p,[s],check=False),[a,b]))
        self.assertEqual(sum(r.returncode==0 for r in results),1)
        current=outline(p);write(p,current['sections'])
        self.assertEqual(outline(p)['revision'],1)
        event=json.loads(value(f"SELECT to_jsonb(e) FROM public.audit_events e WHERE entity_type='ai_practice_outlines' AND entity_id='{p['sourceId']}'",A))
        self.assertEqual(event['actor_id'],I);self.assertEqual(event['new_values']['sections'],'[REDACTED]');self.assertNotIn('PRIVATE TITLE',json.dumps(event))
        self.assertNotEqual(write(p,[],0,check=False).returncode,0)

    def test_mandatory_audit_failure_leaves_mapping_and_sessions_unchanged(self):
        c,p=setup();a=section();write(p,[a]);sid=session(c,pick(p,[a['id']]))
        run("CREATE FUNCTION public.fail_outline_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='ai_practice_outlines' THEN RAISE EXCEPTION 'Audit unavailable'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_outline BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_outline_audit()")
        try:self.assertNotEqual(write(p,[],1,check=False).returncode,0);self.assertEqual(outline(p)['revision'],1);self.assertEqual(read(sid)['revision'],1)
        finally:run('DROP TRIGGER fail_outline ON public.audit_events;DROP FUNCTION public.fail_outline_audit()')

    def test_changed_outline_invalidates_chapter_sessions_and_aggregates_not_manual_pages(self):
        c,p=setup();a=section(pages=[2]);write(p,[a]);chosen=pick(p,[a['id']]);sid=session(c,chosen);publish(sid,p);save(sid,read(sid)['revision'],0,True)
        manual=session(c,{**p,'pages':[2]});write(p,[{**a,'title':'Revised chapter'}],1)
        self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{sid}')",U,False).returncode,0)
        self.assertNotEqual(context(sid,check=False).returncode,0);self.assertNotEqual(publish(sid,p,check=False).returncode,0)
        self.assertEqual(read(manual)['revision'],1);self.assertEqual(report(c)['unavailableSessions'],1);self.assertEqual(report(c)['summary']['practice']['pending'],0)

    def test_file_revision_deletion_and_enrollment_revocation_fail_closed(self):
        c,p=setup();a=section();write(p,[a]);chosen=pick(p,[a['id']]);sid=session(c,chosen)
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
        self.assertNotEqual(outline(p,check=False).returncode,0);self.assertNotEqual(context(sid,check=False).returncode,0)
        run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}';UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
        result=outline(p);self.assertTrue(result['stale']);self.assertEqual(result['sections'],[])
        self.assertNotEqual(preview(c,[chosen],check=False).returncode,0)
        run(f"DELETE FROM public.course_materials WHERE id=(SELECT material_id FROM public.ai_tutor_sources WHERE id='{p['sourceId']}')",I)
        self.assertNotEqual(outline(p,check=False).returncode,0)

    def test_trusted_chapter_and_topic_citations_are_hidden_until_answer_release(self):
        for mode in ['practice','exam']:
            c,p=setup();a=section();b=section('topic',[2],a['id'],'مشتقة الدالة');write(p,[a,b]);chosen=pick(p,[b['id']]);sid=session(c,chosen,mode)
            publish(sid,p);self.assertIsNone(read(sid)['questions'][0]['feedback']);save(sid,read(sid)['revision'],0,True)
            if mode=='exam':
                self.assertIsNone(read(sid)['questions'][0]['feedback']);run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
            parts=read(sid)['questions'][0]['feedback']['citations'][0]['outline']
            self.assertEqual({x['title'] for x in parts},{a['title'],b['title']});self.assertEqual({x['kind'] for x in parts},{'chapter','topic'})
            self.assertEqual(value(f"SELECT count(*) FROM practice_private.questions WHERE session_id='{sid}'"),'1')

    def test_page_only_scope_and_history_hash_are_compatible_and_never_invent_names(self):
        c,p=setup();a=section();write(p,[a]);sid=session(c,p);publish(sid,p);save(sid,read(sid)['revision'],0,True)
        self.assertNotIn('outline',read(sid)['questions'][0]['feedback']['citations'][0])
        first=session(c,pick(p,[a['id']]));write(p,[{**a,'title':'New'}],1);second=session(c,pick(p,[a['id']],2))
        self.assertNotEqual(value(f"SELECT scope_identity FROM public.ai_practice_sessions WHERE id='{first}'"),value(f"SELECT scope_identity FROM public.ai_practice_sessions WHERE id='{second}'"))

    def test_reindex_with_same_generation_cannot_reuse_missing_outline_pages(self):
        c,p=setup();a=section();write(p,[a]);chosen=pick(p,[a['id']]);sid=session(c,chosen)
        chunks=[{'page':2,'text':'Only page two is extractable now.'}]
        run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_tutor_source('{I}','{p['sourceId']}','{p['revision']}',{literal(chunks)})")
        self.assertTrue(outline(p)['stale']);self.assertEqual(outline(p)['sections'],[])
        self.assertNotEqual(preview(c,[chosen],check=False).returncode,0)
        self.assertNotEqual(context(sid,check=False).returncode,0)
        write(p,[{**a,'pages':[2]}],1);self.assertFalse(outline(p)['stale'])

    def test_uuid_and_page_canonicalization_makes_lost_ack_retry_idempotent(self):
        c,p=setup();a=section(pages=[4,2]);a['id']=a['id'].upper();write(p,[a])
        normalized=outline(p)['sections'];self.assertEqual(normalized[0]['id'],a['id'].lower())
        self.assertEqual(write(p,normalized).stdout.strip(),'1')
        sid=session(c,pick(p,[a['id']]));publish(sid,p);save(sid,read(sid)['revision'],0,True)
        self.assertEqual(read(sid)['questions'][0]['feedback']['citations'][0]['outline'][0]['id'],a['id'].lower())
