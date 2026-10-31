"""Upgrade proof: 0050 histories survive 0051 byte-for-byte except the new index key."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'academic'))
from support import BASE, value
from test_practice_sources import setup
from test_practice_sessions import create, read, save
from test_practice_equivalence import computed, append


class HistoricalPracticeUpgrade(unittest.TestCase):
    def test_0051_preserves_existing_duplicate_attempts_answers_and_scores(self):
        course, source = setup()
        original, old_duplicate = create(course, source), create(course, source)
        append(original, source)
        append(old_duplicate, source, computed(variable='t'))
        save(original, read(original)['revision'], 0, True)
        snapshot = value("SELECT jsonb_agg(to_jsonb(q) ORDER BY session_id,position) FROM practice_private.questions q")
        sessions = value("SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.ai_practice_sessions s")
        migration = Path(__file__).resolve().parents[2] / 'migrations/0051_ai_practice_equivalence.sql'
        result = subprocess.run(BASE, input=migration.read_text(), text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(snapshot, value("SELECT jsonb_agg(to_jsonb(q)-'derivative_identity' ORDER BY session_id,position) FROM practice_private.questions q"))
        self.assertEqual(sessions, value("SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.ai_practice_sessions s"))
        identities = json.loads(value("SELECT jsonb_agg(derivative_identity) FROM practice_private.questions"))
        self.assertEqual(len(identities), 2)
        self.assertEqual(len(set(identities)), 1)
        self.assertIsNotNone(identities[0])
        append(original, source)  # Existing retry still succeeds, no overwrite.
        future = create(course, source)
        self.assertNotEqual(append(future, source, computed(language='ar'), check=False).returncode, 0)
        deliberate = create(course, source, repeat=True)
        append(deliberate, source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
