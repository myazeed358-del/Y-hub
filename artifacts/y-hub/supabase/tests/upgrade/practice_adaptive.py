"""0051 -> 0052 preserves historical attempts/answers/reviews and manual behavior."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'academic'))
from support import BASE, value
from test_practice_sources import setup
from test_practice_sessions import create, read, save
from test_practice_equivalence import append
from test_practice_review import begin, auto, request, resolve, score
from test_practice_adaptive import adaptive, context


class HistoricalAdaptiveUpgrade(unittest.TestCase):
    def test_existing_attempts_are_preserved_and_manual_generation_stays_compatible(self):
        course, source = setup()
        original = create(course, source)
        append(original, source)
        save(original, read(original)['revision'], 0, True)
        review = begin(original).stdout.strip(); auto(review); request(review); resolve(review, choice=0)
        before = read(original); assessment = score(original)
        snapshots = {}
        for table in ['practice_private.questions', 'public.ai_practice_sessions', 'public.ai_practice_reviews', 'practice_private.review_details']:
            snapshots[table] = value(f"SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM {table} t")
        migration = Path(__file__).resolve().parents[2] / 'migrations/0052_ai_practice_adaptive_difficulty.sql'
        result = subprocess.run(BASE, input=migration.read_text(), text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        for table, snapshot in snapshots.items():
            projection = "to_jsonb(t)-'scope_identity'" if table == 'public.ai_practice_sessions' else 'to_jsonb(t)'
            self.assertEqual(snapshot, value(f"SELECT jsonb_agg({projection} ORDER BY ({projection})::text) FROM {table} t"))
        after = read(original)
        generation = after['questions'][0].pop('generation')
        self.assertEqual(after, before)
        self.assertEqual(generation, {'difficulty': before['difficulty'], 'reason': 'manual', 'samples': 0})
        self.assertEqual(score(original), assessment)
        self.assertEqual(value('SELECT count(*) FROM practice_private.generation_plans'), '0')
        append(original, source)  # Acknowledgement retry still idempotent.
        legacy = create(course, source, repeat=True)
        append(legacy, source)  # Old manual publication needs no plan.
        new = adaptive(course, source)
        self.assertEqual(context(new)['difficulty'], 'medium')
        self.assertEqual(json.loads(value(f"SELECT to_jsonb(p) FROM practice_private.generation_plans p WHERE session_id='{new}'"))['samples'], 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
