"""Bounded exports must be authorized and accompanied by immutable evidence."""
import unittest
from test_audit import run, query, course, events, S, A, I, STUDENT

class ExportTests(unittest.TestCase):
    def eid(self):
        return events(course())[0]['id']
    def export(self, eid):
        return query(f"SELECT public.export_audit_page(ARRAY['{eid}'::uuid]) AS value", S)[0]['value']
    def test_export_redacted_rows_identity_and_atomic_evidence(self):
        eid = self.eid()
        result = self.export(eid)
        self.assertEqual(result['scope'], 'selected_page')
        self.assertEqual(result['format_version'], 1)
        self.assertEqual([e['id'] for e in result['events']], [eid])
        row = result['events'][0]
        self.assertEqual(row['new_values']['title'], '[REDACTED]')
        self.assertNotIn('transaction_id', row)
        self.assertNotIn('search_document', row)
        self.assertEqual(row['people'][0]['person_id'], I)
        evidence = query(f"SELECT * FROM public.audit_events WHERE id='{result['export_id']}'", S)[0]
        self.assertEqual(evidence['actor_id'], S)
        self.assertEqual(evidence['actions'], ['audit_export_issued'])
        self.assertEqual(evidence['new_values'], {'count': 1, 'event_ids': [eid]})
        self.assertEqual(evidence['context']['delivery'], 'issued')
        self.assertEqual(query(f"SELECT * FROM public.audit_events WHERE id='{result['export_id']}'", A), [])
    def test_rejects_nonowners_anon_and_service(self):
        eid = self.eid()
        sql = f"SELECT public.export_audit_page(ARRAY['{eid}'::uuid])"
        for actor in [I,A,STUDENT]:
            self.assertNotEqual(run(sql,actor,check=False).returncode,0)
        for role in ['anon','service_role']:
            self.assertNotEqual(run(sql,S,role=role,check=False).returncode,0)
    def test_invalid_selection_never_creates_evidence(self):
        eid = self.eid()
        count = query("SELECT count(*) n FROM public.audit_events WHERE actions=ARRAY['audit_export_issued']")[0]['n']
        for selection in ['NULL', "'{}'::uuid[]", 'ARRAY[NULL::uuid]', f"ARRAY['{eid}'::uuid,'{eid}'::uuid]", "ARRAY['99999999-9999-4999-8999-999999999999'::uuid]", f"array_fill('{eid}'::uuid,ARRAY[26])"]:
            self.assertNotEqual(run(f'SELECT public.export_audit_page({selection})',S,check=False).returncode,0)
        self.assertEqual(query("SELECT count(*) n FROM public.audit_events WHERE actions=ARRAY['audit_export_issued']")[0]['n'],count)
    def test_evidence_failure_never_returns_export(self):
        eid = self.eid()
        result = run(f"""CREATE FUNCTION pg_temp.fail_export() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'synthetic export evidence failure'; END $$;
          CREATE TRIGGER fail_export BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_export();
          SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='{S}';
          SELECT public.export_audit_page(ARRAY['{eid}'::uuid])""",check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('synthetic export evidence failure',result.stderr)
        self.assertNotIn('issued_at',result.stdout)
    def test_page_limit_and_repeat_issuance(self):
        ids = query('SELECT id FROM public.audit_events ORDER BY occurred_at DESC,id DESC LIMIT 25',S)
        array = 'ARRAY['+','.join("'"+r['id']+"'::uuid" for r in ids)+']'
        result = query(f'SELECT public.export_audit_page({array}) AS value',S)[0]['value']
        self.assertEqual(len(result['events']),25)
        self.assertEqual([e['id'] for e in result['events']], [r['id'] for r in ids])
        repeated = self.export(ids[0]['id'])
        self.assertNotEqual(repeated['export_id'],result['export_id'])
