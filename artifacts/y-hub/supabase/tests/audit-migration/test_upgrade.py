"""One-shot 0044 -> 0045 upgrade with real in-flight and queued domain writes."""
import subprocess
import sys
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'audit'))
from test_audit import BASE, run, query, I


class AuditUpgrade(unittest.TestCase):
    def wait_state(self, name, wait_type):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if query(f"SELECT pid FROM pg_stat_activity WHERE application_name='{name}' AND wait_event_type='{wait_type}'"):
                return
            time.sleep(.025)
        self.fail(f'{name} did not reach {wait_type}')

    def test_inflight_event_is_backfilled_and_queued_event_uses_new_capture(self):
        before, after = str(uuid.uuid4()), str(uuid.uuid4())
        migration = Path('artifacts/y-hub/supabase/migrations/0045_audit_person_search.sql').read_text()
        # Hold just before COMMIT to observe a new writer waiting behind the migration.
        migration = migration.replace('BEGIN;\n', "BEGIN;\nSET LOCAL application_name='audit-upgrade';\n", 1)
        migration = migration.replace('COMMIT;', 'SELECT pg_sleep(3); COMMIT;')
        with ThreadPoolExecutor(max_workers=3) as pool:
            old = pool.submit(run, f"SET LOCAL application_name='audit-before-upgrade'; INSERT INTO public.courses(id,instructor_id,title) VALUES('{before}','{I}','Before'); SELECT pg_sleep(3)", I)
            self.wait_state('audit-before-upgrade', 'Timeout')
            upgrade = pool.submit(subprocess.run, BASE, input=migration, text=True, capture_output=True, timeout=30)
            self.wait_state('audit-upgrade', 'Lock')
            self.assertEqual(old.result().returncode, 0)
            self.wait_state('audit-upgrade', 'Timeout')
            queued = pool.submit(run, f"SET LOCAL application_name='audit-after-upgrade'; INSERT INTO public.courses(id,instructor_id,title) VALUES('{after}','{I}','After')", I)
            self.wait_state('audit-after-upgrade', 'Lock')
            result = upgrade.result()
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(queued.result().returncode, 0)
        for cid, recorded in ((before, False), (after, True)):
            rows = query(f"SELECT p.* FROM public.audit_event_people p JOIN public.audit_events e ON e.id=p.event_id WHERE e.entity_id='{cid}'")
            self.assertEqual(len(rows), 2)
            self.assertTrue(all(p['recorded'] is recorded and p['person_id'] == I for p in rows))


if __name__ == '__main__': unittest.main(verbosity=2)
