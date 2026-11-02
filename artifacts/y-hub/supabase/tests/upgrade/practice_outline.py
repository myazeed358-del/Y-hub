"""Preserve populated0053 attempts and scope hashes while adding chapter metadata."""
from pathlib import Path
import json
import subprocess
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,run,U
from test_practice_sources import setup,literal
from test_practice_adaptive import history,adaptive,context
from test_practice_review import begin,auto,request,resolve,score
from test_practice_performance import report,weights
from test_practice_outline import section,write,pick,session

class OutlineUpgrade(unittest.TestCase):
    def test_manual_scopes_scores_retries_and_existing_private_state_are_preserved(self):
        c,p=setup();prior=history(c,p,[0,1]);review=begin(prior).stdout.strip();auto(review);request(review);resolve(review,choice=0)
        planned=adaptive(c,p);context(planned);weights(c)
        tables=['public.ai_practice_sessions','practice_private.questions','public.ai_practice_reviews','practice_private.review_details','practice_private.generation_plans','public.ai_practice_performance_weights','public.lesson_completion_overrides','public.lesson_completion_rules']
        snapshots={t:value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r") for t in tables}
        before=report(c);before_score=score(prior)
        migration=Path(__file__).resolve().parents[2]/'migrations/0054_ai_practice_outline_scope.sql'
        result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
        for t,snapshot in snapshots.items():self.assertEqual(snapshot,value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r"))
        self.assertEqual(before,report(c));self.assertEqual(before_score,score(prior))
        self.assertEqual(value("SELECT count(*) FROM public.ai_practice_sessions s WHERE scope_identity<>practice_private.scope_identity(selection,units,query)"),'0')
        saved=json.loads(value(f"SELECT to_jsonb(s) FROM public.ai_practice_sessions s WHERE id='{planned}'"))
        args=f"'{planned}','{c}',{literal(saved['selection'])},'{{}}'::uuid[],'','practice','adaptive','ar',2,true"
        self.assertEqual(run(f'SELECT public.create_ai_practice_session({args})',U).stdout.strip(),planned)
        a=section();write(p,[a]);new=session(c,pick(p,[a['id']]));self.assertNotEqual(new,planned);self.assertEqual(before,report(c))

if __name__=='__main__':unittest.main(verbosity=2)
