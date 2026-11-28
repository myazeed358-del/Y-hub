from pathlib import Path
import subprocess,sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,U
from test_sheets_folders import workbook,folder,organize
class SharingUpgrade(unittest.TestCase):
 def test_existing_files_folders_receipts_audit_and_privacy_unchanged(self):
  id=workbook();f=folder();organize(id,'workbook',parent=f,favorite=True)
  tables=['public.y_sheets_workbooks','public.y_sheets_folders','y_sheets_private.locations','y_sheets_private.save_receipts','public.audit_events','public.audit_event_people']
  def snapshot(t):return value(f'SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM {t} r')
  before={t:snapshot(t) for t in tables};migration=Path(__file__).resolve().parents[2]/'migrations/20261116144657_sheets_sharing.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
  for t in tables:self.assertEqual(snapshot(t),before[t],t)
  self.assertEqual(value('SELECT count(*) FROM y_sheets_private.shares'),'0')
if __name__=='__main__':unittest.main(verbosity=2)
