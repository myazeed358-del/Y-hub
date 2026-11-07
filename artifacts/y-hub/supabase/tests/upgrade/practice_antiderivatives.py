"""0055 -> 0056 preserves existing attempts, scopes, scores, plans and citations."""
from pathlib import Path
import subprocess,sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value
from test_topic_performance import mapped,answer,topics
from test_practice_outline import pick
from test_practice_adaptive import adaptive,context
from test_practice_review import score
from test_practice_performance import report
from test_practice_sessions import create,read
from test_practice_equivalence import append
from test_practice_antiderivatives import computed

class AntiderivativeUpgrade(unittest.TestCase):
 def test_populated_upgrade_preserves_old_behavior_and_accepts_new_capability(self):
  c,p,a,b=mapped();sid=answer(c,p,pick(p,[b['id']]))
  planned=adaptive(c,p);context(planned)
  tables=['public.ai_practice_sessions','practice_private.questions','public.ai_practice_reviews',
    'practice_private.generation_plans','public.ai_practice_outlines','public.audit_events']
  def snapshot(table):return value(f"SELECT jsonb_agg(to_jsonb(r)-'antiderivative_identity' ORDER BY to_jsonb(r)::text) FROM {table} r")
  snapshots={t:snapshot(t) for t in tables};before=[read(sid),score(sid),report(c),topics(c)]
  migration=Path(__file__).resolve().parents[2]/'migrations/0056_practice_antiderivatives.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30)
  self.assertEqual(result.returncode,0,result.stderr)
  for table in tables:self.assertEqual(snapshots[table],snapshot(table))
  self.assertEqual(before,[read(sid),score(sid),report(c),topics(c)])
  fresh=create(c,p);append(fresh,p,computed());self.assertIsNone(read(fresh)['questions'][0]['feedback'])

if __name__=='__main__':unittest.main(verbosity=2)
