"""Read-only new grouping must preserve populated0054 attempts and existing reports."""
from pathlib import Path
import subprocess
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value
from test_topic_performance import mapped,answer,topics
from test_practice_outline import pick
from test_practice_adaptive import adaptive,context
from test_practice_review import begin,auto,request,resolve,score
from test_practice_performance import report,weights

class TopicUpgrade(unittest.TestCase):
 def test_existing_unit_report_and_all_saved_learning_data_are_unchanged(self):
  c,p,a,b=mapped();prior=answer(c,p,pick(p,[b['id']]));review=begin(prior).stdout.strip();auto(review);request(review);resolve(review,choice=0)
  answer(c,p,p,choice=1);planned=adaptive(c,p);context(planned);weights(c)
  tables=['public.ai_practice_sessions','practice_private.questions','public.ai_practice_reviews','practice_private.review_details','practice_private.generation_plans','public.ai_practice_performance_weights','public.ai_practice_outlines','public.lesson_completion_overrides','public.lesson_completion_rules','public.audit_events']
  snapshots={t:value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r") for t in tables}
  before=report(c);before_score=score(prior)
  migration=Path(__file__).resolve().parents[2]/'migrations/0055_ai_practice_topic_performance.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
  for t,snapshot in snapshots.items():self.assertEqual(snapshot,value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r"))
  self.assertEqual(before,report(c));self.assertEqual(before_score,score(prior))
  groups=topics(c)['groups'];self.assertEqual(len(groups),2);self.assertEqual(sum(g['summary']['practice']['graded'] for g in groups),before['summary']['practice']['graded'])
  self.assertEqual(next(g for g in groups if g['attribution'])['attribution']['sectionId'],b['id'])

if __name__=='__main__':unittest.main(verbosity=2)
