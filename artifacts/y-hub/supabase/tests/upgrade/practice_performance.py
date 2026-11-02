"""Add performance reporting to populated0052 without modifying previous attempts."""
from pathlib import Path
import subprocess
import sys
import unittest
import uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,run,I,U
from test_practice_sources import setup
from test_practice_adaptive import history,adaptive,context
from test_practice_review import begin,auto,request,resolve,score
from test_practice_performance import report,weights

class PerformanceUpgrade(unittest.TestCase):
    def test_existing_answers_reviews_plans_and_completion_are_preserved(self):
        c,p=setup();prior=history(c,p,[0,1]);review=begin(prior).stdout.strip();auto(review);request(review);resolve(review,choice=0)
        planned=adaptive(c,p);context(planned)
        unit,topic=str(uuid.uuid4()),str(uuid.uuid4())
        run(f"INSERT INTO public.syllabus_units(id,course_id,title) VALUES('{unit}','{c}','Existing unit');INSERT INTO public.syllabus_sections(id,unit_id,title) VALUES('{topic}','{unit}','Existing lesson')",I)
        run(f"SELECT public.set_lesson_completion('{topic}',0,'completed')",U)
        run(f"SELECT public.set_lesson_completion_rule('{topic}',0,'manual','{{}}'::uuid[])",I)
        tables=['public.ai_practice_sessions','practice_private.questions','public.ai_practice_reviews','practice_private.review_details','practice_private.generation_plans','public.lesson_completion_overrides','public.lesson_completion_rules']
        snapshots={t:value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r") for t in tables}
        before=score(prior)
        migration=Path(__file__).resolve().parents[2]/'migrations/0053_ai_practice_performance.sql'
        result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
        for t,snapshot in snapshots.items():self.assertEqual(snapshot,value(f"SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM {t} r"))
        self.assertEqual(before,score(prior));self.assertEqual(report(c)['summary']['score'],50);self.assertEqual(report(c)['weights']['revision'],0)
        weights(c);self.assertEqual(report(c)['summary']['coverage'],40)

if __name__=='__main__':unittest.main(verbosity=2)
