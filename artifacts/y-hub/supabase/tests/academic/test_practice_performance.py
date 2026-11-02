"""Real local performance aggregation, scope isolation, CAS and required audit."""
import json
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from support import run, value, U, I, A, S, O
from test_practice_sources import setup, literal, publish as publish_source
from test_practice_adaptive import history, adaptive
from test_practice_sessions import create, publish, read
from test_practice_review import begin, auto, request, resolve


def report(course, actor=U, offset=0, check=True):
    result=run(f"SELECT public.read_ai_practice_performance('{course}',{offset})",actor,check)
    return json.loads(result.stdout) if check else result


def weights(course, practice=40, exam=60, revision=0, actor=I, check=True):
    return run(f"SELECT public.set_ai_practice_performance_weights('{course}',{revision},{practice},{exam})",actor,check)


def unit_source(course, count=2):
    units=[str(uuid.uuid4()) for _ in range(count)]
    run("INSERT INTO public.syllabus_units(id,course_id,title,sort_order) VALUES"+','.join(f"('{u}','{course}','Topic {i}',{i})" for i,u in enumerate(units)),I)
    sid=value(f"SELECT id FROM public.ai_tutor_sources WHERE course_id='{course}' AND kind='syllabus'")
    revision=value(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{sid}'")
    publish_source(sid,revision,[{'text':f'Derivative topic {i}','unitId':u} for i,u in enumerate(units)])
    return {'sourceId':sid,'revision':revision,'pages':[]},units


class PracticePerformance(unittest.TestCase):
    def test_empty_has_no_fabricated_zero_and_defaults_do_not_write(self):
        c,p=setup();result=report(c)
        self.assertEqual(result['weights'],{'practice':50,'exam':50,'revision':0})
        self.assertIsNone(result['summary']['score']);self.assertEqual(result['summary']['coverage'],0)
        self.assertEqual(result['summary']['practice'],{'earned':0,'graded':0,'pending':0,'excluded':0,'percent':None})
        self.assertEqual(result['units'],[]);self.assertFalse(result['canManage']);self.assertTrue(report(c,I)['canManage'])
        self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_performance_weights WHERE course_id='{c}'"),'0')

    def test_weighted_categories_are_not_a_micro_average_and_zero_is_real(self):
        c,p=setup();history(c,p,[0,0,1]);exam=history(c,p,[1],mode='exam')
        run(f"SELECT public.submit_ai_practice_session('{exam}',{read(exam)['revision']})",U)
        weights(c,30,70);summary=report(c)['summary']
        self.assertEqual(summary['score'],20);self.assertEqual(summary['coverage'],100)
        self.assertEqual(summary['practice']['percent'],66.67);self.assertEqual(summary['exam']['percent'],0)
        weights(c,0,100,1);self.assertEqual(report(c)['summary']['score'],0)

    def test_missing_or_zero_weight_categories_have_explicit_coverage(self):
        c,p=setup();history(c,p,[0]);weights(c,40,60)
        result=report(c)['summary'];self.assertEqual(result['score'],100);self.assertEqual(result['coverage'],40)
        weights(c,0,100,1);self.assertIsNone(report(c)['summary']['score']);self.assertEqual(report(c)['summary']['coverage'],0)

    def test_drafts_and_self_tests_are_hidden_until_the_normal_release_boundary(self):
        c,p=setup();history(c,p,[0],confirmed=False);prior=history(c,p,[0],mode='exam')
        self.assertEqual(report(c)['summary']['practice']['graded'],0);self.assertEqual(report(c)['summary']['exam']['graded'],0)
        run(f"SELECT public.submit_ai_practice_session('{prior}',{read(prior)['revision']})",U)
        self.assertEqual(report(c)['summary']['exam']['graded'],1)

    def test_suggestions_pending_exclusions_and_human_override_match_assessment(self):
        c,p=setup();prior=history(c,p,[0,1]);ordinary=create(c,p);publish(ordinary,p)
        run(f"SELECT public.save_ai_practice_answer('{ordinary}',1,{read(ordinary)['revision']},0,true)",U)
        summary=report(c)['summary']['practice'];self.assertEqual((summary['graded'],summary['pending']),(2,1))
        review=begin(prior).stdout.strip();self.assertEqual(report(c)['summary']['practice']['graded'],1)
        auto(review);request(review);resolve(review,choice=1)
        summary=report(c)['summary']['practice'];self.assertEqual((summary['earned'],summary['graded']),(0,2))
        other=begin(ordinary).stdout.strip();auto(other);request(other);resolve(other,choice=None)
        summary=report(c)['summary']['practice'];self.assertEqual((summary['pending'],summary['excluded']),(0,1))

    def test_current_source_generation_and_deleted_material_are_excluded_without_history_loss(self):
        for delete in [False,True]:
            c,p=setup();prior=history(c,p,[0]);self.assertEqual(report(c)['summary']['practice']['graded'],1)
            if delete:run(f"DELETE FROM public.course_materials WHERE id=(SELECT material_id FROM public.ai_tutor_sources WHERE id='{p['sourceId']}')",I)
            else:run(f"UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
            result=report(c);self.assertIsNone(result['summary']['score']);self.assertEqual(result['unavailableSessions'],1)
            self.assertEqual(value(f"SELECT count(*) FROM practice_private.questions WHERE session_id='{prior}'"),'1')

    def test_only_own_actual_section_results_never_platform_role_bypass(self):
        c,p=setup();history(c,p,[0]);c2,p2=setup();history(c2,p2,[1]);self.assertEqual(report(c)['summary']['score'],100)
        self.assertEqual(report(c2)['summary']['score'],0);self.assertIsNone(report(c,I)['summary']['score'])
        for actor in [O,A,S]:self.assertNotEqual(report(c,actor,check=False).returncode,0)
        self.assertNotEqual(run(f"SET LOCAL ROLE anon;SELECT public.read_ai_practice_performance('{c}')",check=False).returncode,0)
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
        self.assertNotEqual(report(c,check=False).returncode,0)

    def test_current_role_and_assignment_required_for_weight_changes(self):
        c,p=setup()
        for actor in [U,O,A,S]:self.assertNotEqual(weights(c,actor=actor,check=False).returncode,0)
        run(f"SELECT public.admin_set_user_role('{I}','student')",S)
        try:self.assertNotEqual(weights(c,check=False).returncode,0)
        finally:run(f"SELECT public.admin_set_user_role('{I}','instructor')",S)
        run(f"UPDATE public.courses SET instructor_id='{A}' WHERE id='{c}'")
        self.assertNotEqual(weights(c,check=False).returncode,0);self.assertEqual(weights(c,actor=A).returncode,0)

    def test_direct_tables_helpers_and_forged_scores_are_inaccessible(self):
        c,p=setup();weights(c)
        for actor in [U,I,A,S,O]:
            for sql in ["INSERT INTO public.ai_practice_performance_weights DEFAULT VALUES","UPDATE public.ai_practice_performance_weights SET practice_weight=100","DELETE FROM public.ai_practice_performance_weights",f"SELECT * FROM practice_private.performance_rows('{U}','{c}')"]:
                self.assertNotEqual(run(sql,actor,False).returncode,0)
        for actor in [A,S,O]:self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_performance_weights WHERE course_id='{c}'",actor),'0')

    def test_weight_validation_cas_retry_and_audit_identity(self):
        c,p=setup()
        for a,b in [(101,-1),(0,0),(20,50)]:self.assertNotEqual(weights(c,a,b,check=False).returncode,0)
        self.assertEqual(weights(c).stdout.strip(),'1');self.assertEqual(weights(c).stdout.strip(),'1')
        self.assertNotEqual(weights(c,70,30,0,check=False).returncode,0)
        weights(c,70,30,1)
        events=json.loads(value(f"SELECT jsonb_agg(jsonb_build_object('actor',actor_id,'old',old_values,'new',new_values) ORDER BY occurred_at) FROM public.audit_events WHERE entity_type='ai_practice_performance_weights' AND context->>'course_id'='{c}'",A))
        self.assertEqual(len(events),2);self.assertEqual(events[-1]['actor'],I)
        self.assertEqual(events[-1]['old']['practice_weight'],40);self.assertEqual(events[-1]['new']['practice_weight'],70)

    def test_concurrent_weight_updates_have_one_winner(self):
        c,p=setup()
        with ThreadPoolExecutor(2) as pool:replies=list(pool.map(lambda v:weights(c,v,100-v,check=False),[30,70]))
        self.assertEqual(sum(r.returncode==0 for r in replies),1)
        self.assertEqual(report(c)['weights']['revision'],1)

    def test_required_audit_failure_rolls_back_weight_change(self):
        c,p=setup();weights(c)
        run("CREATE FUNCTION public.fail_weight_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='ai_practice_performance_weights' THEN RAISE EXCEPTION 'Audit unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_weight_audit BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.fail_weight_audit()")
        try:
            self.assertNotEqual(weights(c,80,20,1,check=False).returncode,0);self.assertEqual(report(c)['weights']['practice'],40)
        finally:run('DROP TRIGGER fail_weight_audit ON public.audit_events;DROP FUNCTION public.fail_weight_audit()')

    def test_trusted_unit_attribution_and_unmapped_pdf_never_guess_topics(self):
        c,p=setup();pick,units=unit_source(c);history(c,p,[1]);history(c,pick,[0],units=[units[0]])
        result=report(c);mapped=next(u for u in result['units'] if u['unitId']==units[0]);unmapped=next(u for u in result['units'] if u['unitId'] is None)
        self.assertEqual(mapped['summary']['score'],100);self.assertEqual(unmapped['summary']['score'],0)
        self.assertEqual(result['summary']['practice']['graded'],2)

    def test_pagination_bounds_and_global_totals_are_consistent(self):
        c,p=setup();pick,units=unit_source(c,21)
        # Real ordinary question publications from individually selected trusted units.
        for u in units:
            sid=adaptive(c,pick,'medium',units=[u],target=1)
            chunk=value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{pick['sourceId']}' AND unit_id='{u}'")
            question={'prompt':'Concept '+u,'options':['a','b','c','d'],'correct':0,'explanation':'Supported'}
            run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_question('{U}','{sid}',1,{literal(question)},ARRAY['{chunk}'::uuid])")
            run(f"SELECT public.save_ai_practice_answer('{sid}',1,{read(sid)['revision']},0,true)",U)
        first=report(c);second=report(c,offset=20)
        self.assertEqual((len(first['units']),len(second['units']),first['unitCount']),(20,1,21))
        self.assertTrue(first['hasMore']);self.assertFalse(second['hasMore']);self.assertEqual(first['summary'],second['summary'])
        self.assertEqual(first['summary']['practice']['pending'],21)
        for offset in [-1,10001]:self.assertNotEqual(report(c,offset=offset,check=False).returncode,0)

    def test_mixed_unit_evidence_counts_once_as_unclassified(self):
        c,_=setup();pick,units=unit_source(c);sid=create(c,pick)
        chunks=json.loads(value(f"SELECT jsonb_agg(id) FROM public.ai_tutor_chunks WHERE source_id='{pick['sourceId']}'"))
        question={'prompt':'Compare the units','options':['a','b','c','d'],'correct':0,'explanation':'Supported comparison'}
        ids=','.join(repr(x)+'::uuid' for x in chunks)
        run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_question('{U}','{sid}',1,{literal(question)},ARRAY[{ids}])")
        run(f"SELECT public.save_ai_practice_answer('{sid}',1,{read(sid)['revision']},0,true)",U)
        result=report(c);self.assertEqual(result['unitCount'],1);self.assertIsNone(result['units'][0]['unitId'])
        self.assertEqual(result['summary']['practice']['pending'],1)
