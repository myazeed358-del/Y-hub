"""Disposable PostgreSQL: protected answers, current scope and concurrent session writes."""
import json, uuid, unittest
from concurrent.futures import ThreadPoolExecutor
from support import run, value, I, U, A, S, O
from test_practice_sources import setup, literal, publish as publish_source

def create(c,p,mode='practice',target=2,repeat=False,id=None,actor=U,check=True):
 id=id or str(uuid.uuid4())
 result=run(f"SELECT public.create_ai_practice_session('{id}','{c}',{literal([p])},'{{}}','','{mode}','medium','ar',{target},{str(repeat).lower()})",actor,check)
 return id if check else result

def read(id,actor=U):return json.loads(value(f"SELECT public.read_ai_practice_session('{id}')",actor))
def publish(id,p,position=1,prompt='What is the derivative?',actor=U,check=True):
 chunk=value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{p['sourceId']}' ORDER BY ordinal LIMIT 1")
 q={'prompt':prompt,'options':['2x','3x','4x','5x'],'correct':0,'explanation':'Use the power rule: $2x$.'}
 return run(f"SET LOCAL ROLE service_role;SELECT public.publish_ai_practice_question('{actor}','{id}',{position},{literal(q)},ARRAY['{chunk}'::uuid])",check=check)
def save(id,revision,choice,answer=False,check=True):return run(f"SELECT public.save_ai_practice_answer('{id}',1,{revision},{choice},{str(answer).lower()})",U,check)

class PracticeSessions(unittest.TestCase):
 def test_idempotent_creation_never_deletes_previous_sessions(self):
  c,p=setup();a=create(c,p);create(c,p,id=a);b=create(c,p)
  self.assertNotEqual(a,b);self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_sessions WHERE course_id='{c}'",U),'2')
  self.assertNotEqual(create(c,p,id=a,target=3,check=False).returncode,0)
 def test_question_key_is_hidden_and_released_only_after_practice_answer(self):
  c,p=setup();id=create(c,p);publish(id,p);state=read(id);self.assertIsNone(state['questions'][0]['feedback'])
  save(id,state['revision'],0);state=read(id);self.assertIsNone(state['questions'][0]['feedback'])
  save(id,state['revision'],0,True);q=read(id)['questions'][0];self.assertTrue(q['feedback']['matchesSuggestion']);self.assertEqual(q['feedback']['citations'][0]['page'],2)
  self.assertNotEqual(save(id,read(id)['revision'],1,True,False).returncode,0)
 def test_exam_feedback_waits_for_idempotent_final_submission(self):
  c,p=setup();id=create(c,p,mode='exam',target=1);publish(id,p);save(id,read(id)['revision'],1,True)
  self.assertIsNone(read(id)['questions'][0]['feedback']);revision=read(id)['revision']
  command=f"SELECT public.submit_ai_practice_session('{id}',{revision})"
  self.assertEqual(value(command,U),value(command,U));state=read(id);self.assertFalse(state['questions'][0]['feedback']['matchesSuggestion'])
 def test_direct_access_and_forged_worker_actor_denied(self):
  c,p=setup();id=create(c,p);publish(id,p)
  for actor in [U,I,A,S,O]:
   for command in ['SELECT * FROM practice_private.questions','INSERT INTO public.ai_practice_sessions DEFAULT VALUES','UPDATE public.ai_practice_sessions SET revision=9','DELETE FROM public.ai_practice_sessions',f"SELECT public.ai_practice_generation_context('{U}','{id}',1)"]:
    self.assertNotEqual(run(command,actor,False).returncode,0)
  for actor in [I,A,S,O]:
   self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{id}')",actor,False).returncode,0)
   self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_sessions WHERE id='{id}'",actor),'0')
 def test_revocation_and_source_changes_hide_old_question_content(self):
  c,p=setup();id=create(c,p);publish(id,p)
  run(f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}'")
  self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{id}')",U,False).returncode,0)
  self.assertNotEqual(publish(id,p,2,'Next',check=False).returncode,0)
  run(f"UPDATE public.course_enrollments SET status='active' WHERE course_id='{c}';UPDATE public.ai_tutor_sources SET revision=gen_random_uuid() WHERE id='{p['sourceId']}'")
  self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{id}')",U,False).returncode,0)
  self.assertEqual(value(f"SELECT count(*) FROM public.ai_practice_sessions WHERE id='{id}'",U),'1')
 def test_concurrent_draft_choices_have_one_winner_and_retry_keeps_revision(self):
  c,p=setup();id=create(c,p);publish(id,p);rev=read(id)['revision']
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda choice:save(id,rev,choice,check=False),[0,1]))
  self.assertEqual(sum(r.returncode==0 for r in results),1);state=read(id)
  self.assertEqual(int(save(id,rev,state['questions'][0]['choice']).stdout),state['revision'])
 def test_same_position_generation_race_and_lost_ack_append_once(self):
  c,p=setup();id=create(c,p)
  with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:publish(id,p,check=False),range(2)))
  self.assertTrue(all(r.returncode==0 for r in results));publish(id,p)
  self.assertEqual(len(read(id)['questions']),1);self.assertEqual(read(id)['revision'],2)
 def test_no_client_evidence_or_foreign_source_can_be_published(self):
  c,p=setup();id=create(c,p);c2,p2=setup()
  self.assertNotEqual(publish(id,p2,check=False).returncode,0)
  self.assertEqual(read(id)['questions'],[])
 def test_duplicate_history_and_explicit_repeat_option(self):
  c,p=setup();id=create(c,p,target=1);publish(id,p)
  second=create(c,p);self.assertNotEqual(publish(second,p,check=False).returncode,0)
  deliberate=create(c,p,repeat=True);publish(deliberate,p)
  self.assertNotEqual(publish(deliberate,p,2,check=False).returncode,0)
 def test_bounds_empty_context_and_incomplete_submission(self):
  c,p=setup()
  for target in [0,101]:self.assertNotEqual(create(c,p,target=target,check=False).returncode,0)
  id=create(c,p,target=100);self.assertNotEqual(run(f"SELECT public.submit_ai_practice_session('{id}',1)",U,False).returncode,0)
  self.assertNotEqual(publish(id,p,2,check=False).returncode,0)
 def test_metadata_pagination_is_scoped(self):
  c,p=setup()
  for _ in range(22):create(c,p)
  self.assertEqual(len(json.loads(value(f"SELECT public.list_ai_practice_sessions('{c}')",U))),20)
  self.assertEqual(len(json.loads(value(f"SELECT public.list_ai_practice_sessions('{c}',20)",U))),2)
  self.assertEqual(json.loads(value(f"SELECT public.list_ai_practice_sessions('{c}')",I)),[])
 def test_failed_append_rolls_back_revision_and_question(self):
  c,p=setup();id=create(c,p)
  try:
   run("CREATE FUNCTION public.fail_practice_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'storage failure'; END $$;CREATE TRIGGER fail_write BEFORE UPDATE ON public.ai_practice_sessions FOR EACH ROW EXECUTE FUNCTION public.fail_practice_write()")
   self.assertNotEqual(publish(id,p,check=False).returncode,0);self.assertEqual(read(id)['revision'],1);self.assertEqual(read(id)['questions'],[])
  finally:run('DROP TRIGGER fail_write ON public.ai_practice_sessions;DROP FUNCTION public.fail_practice_write()')

 def test_evidence_windows_rotate_through_scope_and_are_owner_only(self):
  c,p=setup();publish_source(p['sourceId'],p['revision'],[{'text':f'Chapter {i}', 'page':i+1} for i in range(14)])
  id=create(c,p,target=3)
  windows=[json.loads(value(f"SELECT public.retrieve_ai_practice_evidence('{id}',{pos})",U)) for pos in [1,2,3]]
  self.assertEqual([[e['page'] for e in items] for items in windows],[[1,2,3,4,5,6],[7,8,9,10,11,12],[13,14]])
  self.assertNotEqual(run(f"SELECT public.retrieve_ai_practice_evidence('{id}',1)",I,False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.retrieve_ai_practice_evidence('{id}',4)",U,False).returncode,0)
 def test_revoked_role_and_concurrent_withdrawal_cannot_publish(self):
  c,p=setup();id=create(c,p)
  # The role is authoritative in users, not a cached JWT role.
  try:
   run(f"UPDATE public.users SET role='instructor' WHERE id='{U}'")
   self.assertNotEqual(publish(id,p,check=False).returncode,0)
  finally:run(f"UPDATE public.users SET role='student' WHERE id='{U}'")
  with ThreadPoolExecutor(2) as pool:
   withdrawn=pool.submit(run,f"UPDATE public.course_enrollments SET status='dropped' WHERE course_id='{c}';SELECT pg_sleep(0.3)")
   # Whether publication acquired the authorization lock before withdrawal or
   # waits behind it, no reads or writes are allowed after revocation commits.
   generated=pool.submit(publish,id,p,check=False)
   withdrawn.result();generated.result()
  self.assertNotEqual(publish(id,p,check=False).returncode,0)
  self.assertNotEqual(run(f"SELECT public.read_ai_practice_session('{id}')",U,False).returncode,0)
 def test_full_hundred_question_session_is_incremental_bounded_and_submits(self):
  c,p=setup();id=create(c,p,target=100);chunk=value(f"SELECT id FROM public.ai_tutor_chunks WHERE source_id='{p['sourceId']}' ORDER BY ordinal LIMIT 1")
  run(f"""SET LOCAL ROLE service_role;DO $$ BEGIN FOR n IN 1..100 LOOP
   PERFORM public.publish_ai_practice_question('{U}','{id}',n,jsonb_build_object('prompt','Bounded question '||n,'options',jsonb_build_array('A','B','C','D'),'correct',0,'explanation','Suggestion'),ARRAY['{chunk}'::uuid]);
   END LOOP;END $$""")
  state=read(id);self.assertEqual(len(state['questions']),100);self.assertEqual(state['revision'],101)
  self.assertNotEqual(publish(id,p,101,'Overflow',check=False).returncode,0)
  run(f"SELECT public.submit_ai_practice_session('{id}',101)",U)
  self.assertTrue(all(q['feedback']['matchesSuggestion'] is None for q in read(id)['questions']))
