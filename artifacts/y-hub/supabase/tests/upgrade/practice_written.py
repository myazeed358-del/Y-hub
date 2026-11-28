"""Preserve existing data and results through the additive written-answer upgrade."""
from pathlib import Path
import json, subprocess, sys, unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE, value
from test_topic_performance import mapped, answer, topics
from test_practice_outline import pick
from test_practice_adaptive import adaptive, context
from test_practice_review import score
from test_practice_performance import report
from test_practice_sessions import read

class WrittenUpgrade(unittest.TestCase):
 def test_existing_attempts_scores_and_plans_are_unchanged(self):
  c,p,a,b=mapped();sid=answer(c,p,pick(p,[b['id']]))
  planned=adaptive(c,p);context(planned)
  tables=['public.ai_practice_sessions','practice_private.questions','public.ai_practice_reviews','practice_private.review_details','practice_private.generation_plans','public.ai_practice_outlines','public.audit_events']
  new_fields="ARRAY['written_answer','written_score','written_explanation','written_auto_score','written_resolved_score']"
  def snapshot(t):return value(f"SELECT jsonb_agg(to_jsonb(r)-{new_fields} ORDER BY to_jsonb(r)-{new_fields}) FROM {t} r")
  snapshots={t:snapshot(t) for t in tables};before=[score(sid),report(c),topics(c)];old_read=read(sid)
  migration=Path(__file__).resolve().parents[2]/'migrations/20261114053306_practice_written_answers.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30)
  self.assertEqual(result.returncode,0,result.stderr)
  for table in tables:self.assertEqual(snapshots[table],snapshot(table),table)
  self.assertEqual(before,[score(sid),report(c),topics(c)])
  current=read(sid)
  for q in current['questions']:
   q.pop('writtenAnswer');q.pop('acceptsWritten')
   if q['feedback']:q['feedback'].pop('writtenResult')
  self.assertEqual(old_read,current)

if __name__=='__main__':unittest.main(verbosity=2)
