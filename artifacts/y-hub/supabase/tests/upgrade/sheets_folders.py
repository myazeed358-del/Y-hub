from pathlib import Path
import subprocess,sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,U
from test_sheets_folders import workbook,browse
class SheetsUpgrade(unittest.TestCase):
 def test_existing_files_receipts_and_audit_unchanged(self):
  id=workbook('Preserved workbook')
  tables=['public.y_sheets_workbooks','y_sheets_private.save_receipts','public.audit_events']
  def snapshot(table):return value(f'SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM {table} r')
  before={t:snapshot(t) for t in tables}
  migration=Path(__file__).resolve().parents[2]/'migrations/20261116141052_sheets_folders.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30)
  self.assertEqual(result.returncode,0,result.stderr)
  for t in tables:self.assertEqual(snapshot(t),before[t],t)
  self.assertEqual(browse(search='Preserved workbook')['items'][0]['id'],id)
if __name__=='__main__':unittest.main(verbosity=2)
