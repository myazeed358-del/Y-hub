"""Current, non-overlapping PDF chapter/topic performance through real PostgreSQL."""
import json
import unittest
import uuid
from support import run,value,U,I,A,S,O
from test_practice_sources import setup,source,literal
from test_practice_outline import section,write,pick
from test_practice_sessions import create,read,save
from test_practice_math import math_publish
from test_practice_review import begin,auto,request,resolve
from test_practice_performance import report,weights,unit_source


def topics(c,kind='topic',offset=0,actor=U,check=True):
    r=run(f"SELECT public.read_ai_practice_topic_performance('{c}','{kind}',{offset})",actor,check)
    return json.loads(r.stdout) if check else r

def mapped():
    c,p=setup();chapter=section(title='فصل التفاضل');topic=section('topic',[2],chapter['id'],'Derivatives المشتقات');write(p,[chapter,topic])
    return c,p,chapter,topic

def answer(c,p,selection,mode='practice',choice=0,confirmed=True,math=True,chunks=None):
    sid=create(c,selection,mode=mode,target=1,repeat=True)
    if math:math_publish(sid,p)
    else:
        ids=chunks or [value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{p['sourceId']}' ORDER BY ordinal LIMIT 1")]
        q={'prompt':'Concept '+str(uuid.uuid4()),'options':['a','b','c','d'],'correct':0,'explanation':'Source-backed suggestion'}
        run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_question('{U}','{sid}',1,{literal(q)},ARRAY[{','.join(repr(x)+'::uuid' for x in ids)}])")
    save(sid,read(sid)['revision'],choice,confirmed);return sid

class TopicPerformance(unittest.TestCase):
    def test_empty_report_does_not_fabricate_topics_or_scores(self):
        c,p=setup();result=topics(c);self.assertEqual(result['groups'],[]);self.assertEqual(result['groupCount'],0);self.assertFalse(result['hasMore'])
        self.assertEqual(result['weights'],{'practice':50,'exam':50,'revision':0})

    def test_verified_topic_and_parent_have_the_same_single_answer_in_independent_views(self):
        c,p,a,b=mapped();sid=answer(c,p,pick(p,[b['id']]))
        for kind,entry in [('topic',b),('chapter',a)]:
            result=topics(c,kind);self.assertEqual(result['groupCount'],1);group=result['groups'][0]
            self.assertEqual(group['attribution']['sectionId'],entry['id']);self.assertEqual(group['attribution']['title'],entry['title'])
            self.assertEqual(group['attribution']['sourceId'],p['sourceId']);self.assertEqual(group['attribution']['outlineRevision'],1)
            self.assertEqual(group['summary']['score'],100);self.assertEqual(group['summary']['practice']['graded'],1)
            self.assertEqual(group['summary'],report(c)['summary'])

    def test_drafts_and_unsubmitted_self_tests_never_reveal_scores_or_topic_counts(self):
        c,p,a,b=mapped();chosen=pick(p,[b['id']]);answer(c,p,chosen,confirmed=False)
        sid=answer(c,p,chosen,mode='exam',choice=1);self.assertEqual(topics(c)['groups'],[])
        run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
        group=topics(c)['groups'][0];self.assertEqual(group['summary']['exam']['graded'],1);self.assertEqual(group['summary']['score'],0)

    def test_weighted_categories_missing_coverage_and_real_zero_follow_existing_policy(self):
        c,p,a,b=mapped();chosen=pick(p,[b['id']]);answer(c,p,chosen);weights(c,30,70)
        self.assertEqual(topics(c)['groups'][0]['summary']['coverage'],30)
        sid=answer(c,p,chosen,mode='exam',choice=1);run(f"SELECT public.submit_ai_practice_session('{sid}',{read(sid)['revision']})",U)
        summary=topics(c)['groups'][0]['summary'];self.assertEqual(summary['score'],30);self.assertEqual(summary['coverage'],100)
        weights(c,0,100,1);self.assertEqual(topics(c)['groups'][0]['summary']['score'],0)

    def test_pending_review_human_resolution_and_exclusion_update_without_cached_scores(self):
        c,p,a,b=mapped();sid=answer(c,p,pick(p,[b['id']]))
        review=begin(sid).stdout.strip();summary=topics(c)['groups'][0]['summary'];self.assertIsNone(summary['score']);self.assertEqual(summary['practice']['pending'],1)
        auto(review);request(review);resolve(review,choice=1);self.assertEqual(topics(c)['groups'][0]['summary']['score'],0)
        ordinary=answer(c,p,pick(p,[b['id']]),math=False);r=begin(ordinary).stdout.strip();auto(r);request(r);resolve(r,choice=None)
        summary=topics(c)['groups'][0]['summary'];self.assertEqual(summary['practice']['excluded'],1);self.assertEqual(summary['practice']['graded'],1)

    def test_manual_page_history_is_not_retroactively_classified(self):
        c,p=setup();answer(c,p,p);a=section();b=section('topic',[2],a['id']);write(p,[a,b])
        result=topics(c);self.assertIsNone(result['groups'][0]['attribution']);self.assertEqual(result['groups'][0]['summary']['practice']['graded'],1)

    def test_ambiguous_topics_count_once_unclassified_while_shared_chapter_is_known(self):
        c,p,a,b=mapped();other=section('topic',[2],a['id'],'Other');write(p,[a,b,other],1)
        answer(c,p,pick(p,[b['id'],other['id']],2))
        result=topics(c);self.assertEqual(result['groupCount'],1);self.assertIsNone(result['groups'][0]['attribution']);self.assertEqual(result['groups'][0]['summary']['practice']['graded'],1)
        self.assertEqual(topics(c,'chapter')['groups'][0]['attribution']['sectionId'],a['id'])

    def test_equal_names_and_ids_in_different_files_do_not_merge(self):
        c,p,a,b=mapped();q=source(c);write(q,[a,b])
        answer(c,p,pick(p,[b['id']]));answer(c,q,pick(q,[b['id']]))
        groups=topics(c)['groups'];self.assertEqual(len(groups),2);self.assertEqual({g['attribution']['sourceId'] for g in groups},{p['sourceId'],q['sourceId']})
        self.assertEqual(sum(g['summary']['practice']['graded'] for g in groups),2)

    def test_mixed_or_partially_mapped_evidence_stays_unclassified(self):
        for map_second in [False,True]:
            c,p,a,b=mapped();q=source(c)
            if map_second:write(q,[a,b])
            chosen=[pick(p,[b['id']]),pick(q,[b['id']]) if map_second else q]
            # create accepts a single pick; request the real multi-source scope explicitly.
            sid=str(uuid.uuid4());run(f"SELECT public.create_ai_practice_session('{sid}','{c}',{literal(chosen)},'{{}}','','practice','medium','en',1,true)",U)
            ids=[value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{r['sourceId']}' ORDER BY ordinal LIMIT 1") for r in [p,q]]
            question={'prompt':'Combined','options':['a','b','c','d'],'correct':0,'explanation':'Both sources'}
            run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_question('{U}','{sid}',1,{literal(question)},ARRAY[{','.join(repr(x)+'::uuid' for x in ids)}])")
            save(sid,read(sid)['revision'],0,True)
            result=topics(c);self.assertEqual(len(result['groups']),1);self.assertIsNone(result['groups'][0]['attribution']);self.assertEqual(result['groups'][0]['summary']['practice']['pending'],1)

    def test_unavailable_outline_or_source_is_excluded_without_removing_answers(self):
        for change in ['outline','source','delete']:
            c,p,a,b=mapped();sid=answer(c,p,pick(p,[b['id']]))
            if change=='outline':write(p,[a,{**b,'title':'Changed'}],1)
            elif change=='source':run(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
            else:run(f"DELETE FROM public.course_materials WHERE id=(SELECT material_id FROM public.ai_tutor_sources WHERE id='{p['sourceId']}')",I)
            self.assertEqual(topics(c)['groups'],[]);self.assertEqual(report(c)['unavailableSessions'],1)
            self.assertEqual(value(f"SELECT count(*) FROM practice_private.questions WHERE session_id='{sid}'"),'1')

    def test_access_is_current_private_and_never_overridden_by_platform_role(self):
        c,p,a,b=mapped();answer(c,p,pick(p,[b['id']]))
        self.assertEqual(topics(c,actor=I)['groups'],[])
        for actor in [O,A,S]:self.assertNotEqual(topics(c,actor=actor,check=False).returncode,0)
        for role in ['anon','service_role']:self.assertNotEqual(run(f"SET LOCAL ROLE {role};SELECT public.read_ai_practice_topic_performance('{c}','topic')",check=False).returncode,0)
        for actor in [U,I,A,S]:
            for sql in [f"SELECT * FROM practice_private.performance_answers('{U}','{c}')","SELECT practice_private.performance_attribution('[]','topic')"]:self.assertNotEqual(run(sql,actor,False).returncode,0)
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
        self.assertNotEqual(topics(c,check=False).returncode,0)
        run(f"SELECT public.admin_set_user_role('{I}','student')",S)
        try:self.assertNotEqual(topics(c,actor=I,check=False).returncode,0)
        finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)

    def test_server_pagination_is_bounded_stable_and_has_no_duplicate_groups(self):
        c,p=setup();entries=[section('topic',[2],title=f'Topic {i}') for i in range(21)];write(p,entries)
        for entry in entries:answer(c,p,pick(p,[entry['id']]),math=False)
        first=topics(c);second=topics(c,offset=20)
        self.assertEqual((len(first['groups']),len(second['groups']),first['groupCount']),(20,1,21));self.assertTrue(first['hasMore']);self.assertFalse(second['hasMore'])
        self.assertEqual(len({g['attribution']['sectionId'] for g in first['groups']+second['groups']}),21);self.assertEqual(topics(c)['groups'],first['groups'])
        self.assertEqual(sum(g['summary']['practice']['pending'] for g in first['groups']+second['groups']),21)
        self.assertEqual(topics(c,offset=40)['groups'],[])
        for kind,offset in [('unit',0),('topic',-1),('chapter',10001)]:self.assertNotEqual(topics(c,kind,offset,check=False).returncode,0)
