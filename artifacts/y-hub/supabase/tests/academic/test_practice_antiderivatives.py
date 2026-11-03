"""Real engine output + isolated PostgreSQL, including atomic equivalence admission."""
import copy,json,subprocess,unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from support import run,value,U,I,A,S,O
from test_practice_sources import setup,literal
from test_practice_sessions import create,read,save
from test_practice_equivalence import append,computed as derivative
from test_practice_review import score,begin,auto,request,resolve
from test_practice_adaptive import adaptive,context

def computed(constant=2,variable='x',language='en',reverse=False):
 task={'kind':'polynomial_antiderivative','variable':variable,'coefficients':[constant,-6,3],
       'options':[[0,constant,-3,1],[0,constant,-6,1],[0,constant,-3,3],[0]]}
 if reverse:task['options'].reverse()
 module=(Path(__file__).resolve().parents[2]/'functions/_shared/tutor/polynomialVerifier.mjs').as_uri()
 code='import {verifyAntiderivative} from '+json.dumps(module)+';process.stdout.write(JSON.stringify(verifyAntiderivative('+json.dumps(task)+','+json.dumps(language)+')));'
 return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],text=True,timeout=10))

class Antiderivatives(unittest.TestCase):
 def test_score_and_private_evidence_are_released_only_after_answer(self):
  c,p=setup();sid=create(c,p,target=1);append(sid,p,computed(language='ar'))
  self.assertIsNone(read(sid)['questions'][0]['feedback']);self.assertEqual(score(sid)['graded'],0)
  save(sid,read(sid)['revision'],0,True)
  self.assertEqual(score(sid)['earned'],1)
  self.assertEqual(read(sid)['questions'][0]['feedback']['verification'],'polynomial-antiderivative-v1')
  review=begin(sid).stdout.strip();self.assertEqual(score(sid)['graded'],0)
  auto(review);request(review);resolve(review,choice=None);self.assertEqual(score(sid)['excluded'],1)
 def test_equivalence_ignores_language_variable_options_but_preserves_integrand_constant(self):
  c,p=setup();append(create(c,p),p,computed())
  for kwargs in [dict(variable='t'),dict(language='ar'),dict(reverse=True)]:
   sid=create(c,p);r=append(sid,p,computed(**kwargs),check=False)
   self.assertNotEqual(r.returncode,0);self.assertIn('Repeated',r.stderr);self.assertEqual(read(sid)['revision'],1)
  sid=create(c,p);append(sid,p,computed(constant=3));self.assertEqual(len(read(sid)['questions']),1)
 def test_concurrent_devices_admit_only_one_equivalent_exercise(self):
  c,p=setup();sessions=[create(c,p),create(c,p)];results=[computed(),computed(language='ar')]
  with ThreadPoolExecutor(2) as pool:out=list(pool.map(lambda i:append(sessions[i],p,results[i],check=False),range(2)))
  self.assertEqual(sum(r.returncode==0 for r in out),1)
  self.assertEqual(sum(len(read(s)['questions']) for s in sessions),1)
 def test_retraining_and_lost_ack_do_not_duplicate_or_overwrite(self):
  c,p=setup();append(create(c,p),p,computed());sid=create(c,p,repeat=True)
  append(sid,p,computed(variable='t'));append(sid,p,computed())
  self.assertEqual(read(sid)['revision'],2);self.assertIn('dt',read(sid)['questions'][0]['prompt'])
  self.assertNotEqual(append(sid,p,computed(),position=2,check=False).returncode,0)
 def test_private_identity_and_service_only_publication(self):
  c,p=setup();sid=create(c,p);append(sid,p,computed())
  for actor in [U,I,A,S,O]:
   self.assertNotEqual(run('SELECT antiderivative_identity FROM practice_private.questions',actor,False).returncode,0)
   self.assertNotEqual(run("SELECT practice_private.antiderivative_identity('{}')",actor,False).returncode,0)
   self.assertNotEqual(run(f"SELECT public.publish_ai_practice_math_question('{U}','{sid}',1,'{{}}','{{}}','{{}}')",actor,False).returncode,0)
  self.assertNotEqual(run("SET LOCAL ROLE service_role;UPDATE practice_private.questions SET antiderivative_identity='fake'",check=False).returncode,0)
 def test_invalid_contracts_fail_without_partial_rows(self):
  c,p=setup();original=computed()
  for patch in [{'coefficients':None},{'coefficients':[1]*9},{'coefficients':[0.5]}, {'variable':'z'},
                {'options':[[0],[0,0],[0,1],[0,2]]},{'options':[[1],[0,1],[0,2],[0,3]]},
                {'options':[[0,801],[0],[0,1],[0,2]]},{'correct':0}]:
   result=copy.deepcopy(original);result['verification']['task'].update(patch);sid=create(c,p)
   self.assertNotEqual(append(sid,p,result,check=False).returncode,0)
   self.assertEqual(read(sid)['questions'],[])
 def test_adaptive_counts_distinct_integrals_not_retraining(self):
  c,p=setup()
  for i in range(5):
   sid=create(c,p,target=1,repeat=True);append(sid,p,computed(language='ar' if i%2 else 'en'))
   save(sid,read(sid)['revision'],0,True)
  planned=adaptive(c,p);result=context(planned)
  self.assertEqual(result['difficulty'],'medium')
  self.assertEqual(value(f"SELECT samples FROM practice_private.generation_plans WHERE session_id='{planned}'"),'1')
  self.assertEqual(result['previousAntiderivativeInputs'],[]) # deliberate retraining allows older exercises
  guidance=context(create(c,p));self.assertEqual(guidance['previousAntiderivativeInputs'],[[2,-6,3]]*5)
  self.assertEqual(result['previousDerivativeInputs'],[])
 def test_derivative_history_and_integral_history_do_not_collide(self):
  c,p=setup();append(create(c,p),p,derivative());append(create(c,p),p,computed())
  ctx=context(create(c,p));self.assertEqual(len(ctx['previousDerivativeInputs']),1)
  self.assertEqual(len(ctx['previousAntiderivativeInputs']),1)
 def test_engine_revocation_and_foreign_sources_roll_back(self):
  c,p=setup();_,foreign=setup();sid=create(c,p);result=computed()
  self.assertNotEqual(append(sid,foreign,result,check=False).returncode,0)
  try:
   run("UPDATE public.module_policies SET enabled=false WHERE id='calculus-1'")
   self.assertNotEqual(append(sid,p,result,check=False).returncode,0)
   self.assertEqual(read(sid)['questions'],[])
  finally:run("UPDATE public.module_policies SET enabled=true WHERE id='calculus-1'")
  append(sid,p,result)
 def test_withdrawn_enrollment_denies_history_and_publication(self):
  c,p=setup();sid=create(c,p);result=computed();append(sid,p,result)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(append(sid,p,result,check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{sid}')",U,False).returncode,0)
