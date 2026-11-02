"""Adaptive policy on real isolated PostgreSQL; only released trusted results count."""
import json
import subprocess
import unittest
import uuid
from functools import lru_cache
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from support import run, value, U, I, A, S, O
from test_practice_sources import setup, literal, source
from test_practice_sessions import read, create, publish
from test_practice_review import begin, auto, request, resolve


def adaptive(course, pick, difficulty='adaptive', actor=U, mode='practice', units=None, query='', target=2):
    sid = str(uuid.uuid4())
    run(f"SELECT public.create_ai_practice_session('{sid}','{course}',{literal(pick if isinstance(pick,list) else [pick])},ARRAY[{','.join(repr(u)+'::uuid' for u in (units or []))}]::uuid[],'{query}','{mode}','{difficulty}','ar',{target},true)", actor)
    return sid


def context(sid, actor=U, position=1, check=True):
    result = run(f"SET LOCAL ROLE service_role;SELECT public.ai_practice_generation_context('{actor}','{sid}',{position})", check=check)
    return json.loads(result.stdout) if check else result


def plan(sid, position=1):
    return json.loads(value(f"SELECT to_jsonb(p) FROM practice_private.generation_plans p WHERE session_id='{sid}' AND position={position}"))


@lru_cache(maxsize=1)
def questions():
    module = (Path(__file__).resolve().parents[2] / 'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
    code = 'import {verifyDerivative} from '+json.dumps(module)+";process.stdout.write(JSON.stringify(Array.from({length:30},(_,k)=>verifyDerivative({kind:'polynomial_derivative',variable:'x',coefficients:[0,k,1],options:[[k,2],[0],[1],[2]]},'en'))));"
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code], text=True, timeout=10))


def history(course, pick, choices, mode='practice', confirmed=True, actor=U, units=None):
    sid = adaptive(course, pick, 'medium', actor, mode, units, target=len(choices))
    chunk = value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{pick['sourceId']}' ORDER BY ordinal LIMIT 1")
    statements=[]
    for i, choice in enumerate(choices, 1):
        q = questions()[i-1]
        statements.append(f"SELECT public.publish_ai_practice_math_question('{actor}','{sid}',{i},{literal(q['question'])},ARRAY['{chunk}'::uuid],{literal(q['verification'])})")
    run('SET LOCAL ROLE service_role;'+';'.join(statements))
    statements=[f"SELECT public.save_ai_practice_answer('{sid}',{i},(SELECT revision FROM public.ai_practice_sessions WHERE id='{sid}'),{choice},{str(confirmed).lower()})" for i, choice in enumerate(choices, 1)]
    run(';'.join(statements), actor)
    return sid


class AdaptivePractice(unittest.TestCase):
    def test_cold_start_uses_medium_and_no_untrusted_score(self):
        c,p=setup();sid=adaptive(c,p)
        self.assertEqual(context(sid)['difficulty'],'medium')
        self.assertEqual((plan(sid)['samples'],plan(sid)['reason']),(0,'insufficient'))
        self.assertEqual(read(sid)['difficulty'],'adaptive')

    def test_manual_levels_stay_manual_even_with_positive_history(self):
        c,p=setup();history(c,p,[0]*5)
        for difficulty in ['easy','medium','hard']:
            sid=adaptive(c,p,difficulty)
            self.assertEqual(context(sid)['difficulty'],difficulty)
            self.assertEqual((plan(sid)['reason'],plan(sid)['samples']),('manual',0))

    def test_minimum_sample_and_exact_thresholds(self):
        for choices,level,reason in [([0]*4,'medium','insufficient'),([1]*5,'easy','support'),([0,0,1,1,1],'easy','support'),([0,0,0,1,1,1],'medium','steady'),([0,0,0,1,1],'medium','steady'),([0,0,0,0,1],'hard','stretch')]:
            c,p=setup();history(c,p,choices);sid=adaptive(c,p)
            self.assertEqual(context(sid)['difficulty'],level)
            self.assertEqual((plan(sid)['samples'],plan(sid)['reason']),(len(choices),reason))

    def test_drafts_and_unsubmitted_self_tests_never_influence_level(self):
        for mode,confirmed in [('practice',False),('exam',False),('exam',True)]:
            c,p=setup();prior=history(c,p,[0]*5,mode,confirmed);sid=adaptive(c,p)
            self.assertEqual(context(sid)['difficulty'],'medium');self.assertEqual(plan(sid)['samples'],0)
            if mode=='exam':
                run(f"SELECT public.submit_ai_practice_session('{prior}',{read(prior)['revision']})",U)
                fresh=adaptive(c,p);self.assertEqual(context(fresh)['difficulty'],'hard')

    def test_model_suggestions_do_not_become_performance_data(self):
        c,p=setup();sid=create(c,p,target=5)
        for i in range(1,6):publish(sid,p,i,f'Theoretical question {i}')
        run(';'.join(f"SELECT public.save_ai_practice_answer('{sid}',{i},(SELECT revision FROM public.ai_practice_sessions WHERE id='{sid}'),0,true)" for i in range(1,6)),U)
        next_id=adaptive(c,p);context(next_id);self.assertEqual(plan(next_id)['samples'],0)

    def test_review_pending_and_excluded_are_removed_human_resolution_overrides(self):
        c,p=setup();prior=history(c,p,[0,0,0,0,1])
        review=begin(prior).stdout.strip()
        sid=adaptive(c,p);context(sid);self.assertEqual(plan(sid)['samples'],4)
        auto(review);request(review);resolve(review,choice=1)
        sid=adaptive(c,p);self.assertEqual(context(sid)['difficulty'],'medium');self.assertEqual(plan(sid)['samples'],5)
        # Exclusion is tested on an independent review, without mutating history.
        c,p=setup();prior=history(c,p,[0]*5);review=begin(prior).stdout.strip()
        auto(review);request(review);resolve(review,choice=None)
        sid=adaptive(c,p);context(sid);self.assertEqual(plan(sid)['samples'],4)

    def test_scope_filters_source_pages_query_units_student_and_section(self):
        c,p=setup();history(c,p,[0]*5)
        for pick,query,actor in [({**p,'pages':[2]},'',U),(p,'derivative',U),(p,'',I)]:
            sid=adaptive(c,pick,actor=actor,query=query);context(sid,actor);self.assertEqual(plan(sid)['samples'],0)
        different=source(c);sid=adaptive(c,different);context(sid);self.assertEqual(plan(sid)['samples'],0)
        c2,p2=setup();sid=adaptive(c2,p2);context(sid);self.assertEqual(plan(sid)['samples'],0)

    def test_scope_identity_normalizes_order_but_keeps_units_and_revisions(self):
        c,p=setup();q=source(c);u,v=str(uuid.uuid4()),str(uuid.uuid4())
        def identity(picks, units, query=''):
            return value(f"SELECT practice_private.scope_identity({literal(picks)},ARRAY[{','.join(repr(x)+'::uuid' for x in units)}]::uuid[],'{query}')")
        a=identity([{**p,'pages':[4,2]},q],[u,v],' derivative  ')
        self.assertEqual(a,identity([q,{**p,'pages':[2,4]}],[v,u],'Derivative'))
        self.assertEqual(a,identity([q,{**p,'sourceId':p['sourceId'].upper(),'revision':p['revision'].upper(),'pages':[2,4,2]}],[v,u,u],'Derivative'))
        self.assertNotEqual(a,identity([q,{**p,'pages':[2,4]}],[u],'Derivative'))
        self.assertNotEqual(a,identity([q,{**p,'revision':str(uuid.uuid4()),'pages':[2,4]}],[v,u],'Derivative'))

    def test_actual_syllabus_units_do_not_mix_performance(self):
        from test_practice_sources import publish as publish_source
        c,_=setup();u,v=str(uuid.uuid4()),str(uuid.uuid4())
        run(f"INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{u}','{c}','Derivatives'),('{v}','{c}','Integrals')",I)
        s=value(f"SELECT id FROM public.ai_tutor_sources WHERE course_id='{c}' AND kind='syllabus'")
        r=value(f"SELECT revision FROM public.ai_tutor_sources WHERE id='{s}'")
        publish_source(s,r,[{'text':'Derivative topic','unitId':u},{'text':'Integral topic','unitId':v}])
        pick={'sourceId':s,'revision':r,'pages':[]};history(c,pick,[0]*5,units=[u])
        same=adaptive(c,pick,units=[u]);self.assertEqual(context(same)['difficulty'],'hard')
        different=adaptive(c,pick,units=[v]);context(different);self.assertEqual(plan(different)['samples'],0)

    def test_human_verified_theoretical_answers_can_contribute(self):
        c,p=setup()
        for i in range(5):
            prior=create(c,p,target=1);publish(prior,p,prompt=f'Conceptual exercise {i}')
            run(f"SELECT public.save_ai_practice_answer('{prior}',1,{read(prior)['revision']},0,true)",U)
            review=begin(prior).stdout.strip();auto(review);request(review);resolve(review,choice=0)
        sid=adaptive(c,p);self.assertEqual(context(sid)['difficulty'],'hard');self.assertEqual(plan(sid)['samples'],5)

    def test_failed_plan_write_rolls_back_and_does_not_allow_publication(self):
        c,p=setup();sid=adaptive(c,p)
        run("CREATE FUNCTION practice_private.fail_plan_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected plan persistence failure'; END $$;CREATE TRIGGER fail_plan_test BEFORE INSERT ON practice_private.generation_plans FOR EACH ROW EXECUTE FUNCTION practice_private.fail_plan_test()")
        try:
            self.assertNotEqual(context(sid,check=False).returncode,0)
            self.assertEqual(value(f"SELECT count(*) FROM practice_private.generation_plans WHERE session_id='{sid}'"),'0')
            self.assertNotEqual(publish(sid,p,check=False).returncode,0)
            self.assertEqual(read(sid)['revision'],1)
        finally:run('DROP TRIGGER fail_plan_test ON practice_private.generation_plans;DROP FUNCTION practice_private.fail_plan_test()')
        self.assertEqual(context(sid)['difficulty'],'medium')

    def test_repeated_exercises_do_not_inflate_sample_count(self):
        c,p=setup()
        for _ in range(5):history(c,p,[0])
        sid=adaptive(c,p);context(sid);self.assertEqual(plan(sid)['samples'],1)

    def test_window_is_capped_at_twenty_distinct_exercises(self):
        c,p=setup();history(c,p,[1]*5+[0]*20)
        sid=adaptive(c,p);self.assertEqual(context(sid)['difficulty'],'hard');self.assertEqual(plan(sid)['samples'],20)

    def test_concurrent_requests_reserve_one_stable_plan_and_no_revision_bump(self):
        c,p=setup();sid=adaptive(c,p)
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:context(sid),range(2)))
        self.assertEqual(results[0],results[1]);before=plan(sid)
        history(c,p,[0]*5)
        self.assertEqual(context(sid)['difficulty'],'medium');self.assertEqual(plan(sid),before)
        self.assertEqual(read(sid)['revision'],1)
        fresh=adaptive(c,p);self.assertEqual(context(fresh)['difficulty'],'hard')

    def test_next_position_uses_newly_confirmed_result_without_rewriting_prior_plan(self):
        c,p=setup();history(c,p,[0]*4);sid=adaptive(c,p,target=2)
        self.assertEqual(context(sid)['difficulty'],'medium')
        chunk=value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{p['sourceId']}' ORDER BY ordinal LIMIT 1")
        q=questions()[4]
        run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_math_question('{U}','{sid}',1,{literal(q['question'])},ARRAY['{chunk}'::uuid],{literal(q['verification'])})")
        run(f"SELECT public.save_ai_practice_answer('{sid}',1,{read(sid)['revision']},0,true)",U)
        self.assertEqual(context(sid,position=2)['difficulty'],'hard')
        self.assertEqual(plan(sid)['samples'],4);self.assertEqual(plan(sid,2)['samples'],5)
        self.assertEqual(read(sid)['questions'][0]['generation']['difficulty'],'medium')

    def test_plan_required_before_publication_and_published_level_is_retained(self):
        c,p=setup();sid=adaptive(c,p)
        self.assertNotEqual(publish(sid,p,check=False).returncode,0)
        self.assertEqual(read(sid)['questions'],[]);self.assertEqual(read(sid)['revision'],1)
        context(sid);publish(sid,p)
        q=read(sid)['questions'][0]
        self.assertEqual(q['generation'],{'difficulty':'medium','reason':'insufficient','samples':0});self.assertIsNone(q['feedback'])
        self.assertTrue(context(sid)['exists'])

    def test_no_browser_role_can_read_forge_or_modify_plans(self):
        c,p=setup();sid=adaptive(c,p);context(sid)
        for actor in [U,I,A,S,O]:
            for sql in ['SELECT * FROM practice_private.generation_plans','INSERT INTO practice_private.generation_plans DEFAULT VALUES',"UPDATE practice_private.generation_plans SET difficulty='hard'",'DELETE FROM practice_private.generation_plans',f"SELECT public.ai_practice_generation_context('{U}','{sid}',1)"]:
                self.assertNotEqual(run(sql,actor,False).returncode,0)
        self.assertNotEqual(run('SET LOCAL ROLE service_role;SELECT * FROM practice_private.generation_plans',check=False).returncode,0)

    def test_revocation_and_changed_source_block_existing_plan(self):
        c,p=setup();sid=adaptive(c,p);context(sid)
        run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
        self.assertNotEqual(context(sid,check=False).returncode,0)
        self.assertNotEqual(publish(sid,p,check=False).returncode,0)
        run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}';UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
        self.assertNotEqual(context(sid,check=False).returncode,0)
