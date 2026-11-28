"""Decision 69 controls against real isolated PostgreSQL roles/transactions."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from test_audit import run, query, course, events, S, A, I, STUDENT

class RetentionTests(unittest.TestCase):
    def policy(self):
        return query('SELECT public.get_audit_retention_policy() AS value', S)[0]['value']

    def test_defaults_and_atomic_audited_change(self):
        old = self.policy()
        months = 36 if old['months'] != 36 else 24
        result = query(f"SELECT public.set_audit_retention_policy({months},{old['revision']}) AS value", S)[0]['value']
        self.assertEqual(result, {'months': months, 'revision': old['revision'] + 1})
        rows = query("SELECT * FROM public.audit_events WHERE actions=ARRAY['retention_policy_changed'] ORDER BY occurred_at DESC LIMIT 1", S)
        self.assertEqual(rows[0]['old_values'], {'months': old['months']})
        self.assertEqual(rows[0]['new_values'], {'months': months})
        self.assertEqual(rows[0]['actor_id'], S)
        self.assertTrue(rows[0]['super_admin_only'])
        self.assertEqual(query(f"SELECT * FROM public.audit_events WHERE id='{rows[0]['id']}'", A), [])
        run(f"SELECT public.set_audit_retention_policy(24,{result['revision']})", S)

    def test_invalid_and_stale_policy_leave_state_unchanged(self):
        old = self.policy()
        for months, rev in [('11', old['revision']), ('61', old['revision']), ('NULL', old['revision']), ('24', -1), ('24', 'NULL')]:
            self.assertNotEqual(run(f'SELECT public.set_audit_retention_policy({months},{rev})', S, check=False).returncode, 0)
        self.assertEqual(self.policy(), old)

    def test_concurrent_policy_writers_only_one_wins(self):
        old = self.policy()
        values = [m for m in [12, 36, 60] if m != old['months']][:2]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda m: run(f"SELECT public.set_audit_retention_policy({m},{old['revision']})", S, check=False), values))
        self.assertEqual(sum(r.returncode == 0 for r in results), 1)
        run(f"SELECT public.set_audit_retention_policy(24,{self.policy()['revision']})", S)

    def test_hold_lifecycle_noop_and_stale_release(self):
        eid = events(course())[0]['id']
        def get():
            return query(f"SELECT public.get_audit_investigation_hold('{eid}') AS value", S)[0]['value']
        self.assertEqual(get(), {'active': False, 'revision': 0})
        run(f"SELECT public.set_audit_investigation_hold('{eid}',true,0)", S)
        self.assertEqual(get(), {'active': True, 'revision': 1})
        run(f"SELECT public.set_audit_investigation_hold('{eid}',true,1)", S)
        self.assertEqual(get()['revision'], 1)
        self.assertNotEqual(run(f"SELECT public.set_audit_investigation_hold('{eid}',false,0)", S, check=False).returncode, 0)
        self.assertTrue(get()['active'])
        run(f"SELECT public.set_audit_investigation_hold('{eid}',false,1)", S)
        self.assertEqual(get(), {'active': False, 'revision': 2})
        self.assertEqual(len(query(f"SELECT * FROM public.audit_events WHERE entity_id='{eid}' AND actions=ARRAY['investigation_hold_changed']", S)), 2)

    def test_owner_only_and_private_storage_denied(self):
        eid = events(course())[0]['id']
        operations = ["SELECT public.get_audit_retention_policy()", "SELECT public.set_audit_retention_policy(12,0)",
                      f"SELECT public.get_audit_investigation_hold('{eid}')", f"SELECT public.set_audit_investigation_hold('{eid}',true,0)"]
        for actor in [A, I, STUDENT]:
            for sql in operations:
                self.assertNotEqual(run(sql, actor, check=False).returncode, 0)
        for role in ['anon', 'service_role']:
            for sql in operations:
                self.assertNotEqual(run(sql, S, role=role, check=False).returncode, 0)
        for table in ['retention_policy','investigation_holds']:
            self.assertNotEqual(run(f'SELECT * FROM yhub_audit_private.{table}', S, check=False).returncode, 0)
        self.assertNotEqual(run("SELECT yhub_audit_private.require_retention_owner()", S, check=False).returncode, 0)

    def test_jwt_owner_claim_cannot_override_database_role(self):
        self.assertNotEqual(run("SET LOCAL request.jwt.claims='{"+'"role":"super_admin"'+"}'; SELECT public.get_audit_retention_policy()", STUDENT, check=False).returncode, 0)

    def test_hold_unknown_event_and_null_rejected(self):
        eid = events(course())[0]['id']
        for sql in [f"SELECT public.set_audit_investigation_hold('{eid}',NULL,0)",
                    "SELECT public.set_audit_investigation_hold('99999999-9999-4999-8999-999999999999',true,0)"]:
            self.assertNotEqual(run(sql, S, check=False).returncode, 0)

    def test_transaction_rollback_reverts_policy_and_evidence(self):
        old = self.policy()
        count = query("SELECT count(*) AS n FROM public.audit_events WHERE actions=ARRAY['retention_policy_changed']")[0]['n']
        run(f"SELECT public.set_audit_retention_policy(60,{old['revision']}); ROLLBACK", S)
        self.assertEqual(self.policy(), old)
        self.assertEqual(query("SELECT count(*) AS n FROM public.audit_events WHERE actions=ARRAY['retention_policy_changed']")[0]['n'], count)

    def test_required_audit_failure_rolls_back_policy(self):
        old = self.policy()
        result = run(f"""
          CREATE FUNCTION pg_temp.fail_retention_audit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
          CREATE TRIGGER fail_retention_audit BEFORE INSERT ON public.audit_events
          FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_retention_audit();
          SET LOCAL ROLE authenticated;
          SET LOCAL request.jwt.claim.sub='{S}';
          SELECT public.set_audit_retention_policy(60,{old['revision']})
        """, check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('synthetic audit failure',result.stderr)
        self.assertEqual(self.policy(),old)
