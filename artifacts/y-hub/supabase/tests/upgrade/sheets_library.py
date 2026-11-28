from pathlib import Path
import subprocess,sys,unittest,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,U
from test_sheets_folders import workbook,folder,organize
from test_sheets_sharing import share,read
from test_sheets_trash import trash
class LibraryUpgrade(unittest.TestCase):
 def test_existing_files_grants_trash_receipts_and_history_are_unchanged(self):
  id=workbook();f=folder();organize(id,'workbook',parent=f);share(id);trash(workbook())
  tables=['public.y_sheets_workbooks','public.y_sheets_folders','y_sheets_private.locations','y_sheets_private.save_receipts','y_sheets_private.shares','y_sheets_private.effective_shares','y_sheets_private.trash_entries','y_sheets_private.lifecycle','public.audit_events','public.audit_event_people']
  def snapshot(t):return value(f'SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM {t} r')
  before={t:snapshot(t) for t in tables};access=json.loads(read(id).stdout)
  migration=Path(__file__).resolve().parents[2]/'migrations/20261118162757_sheets_library.sql';result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
  for t in tables:self.assertEqual(snapshot(t),before[t],t)
  self.assertEqual(json.loads(read(id).stdout),access);self.assertEqual(value('SELECT count(*) FROM y_sheets_private.categories'),'0')
if __name__=='__main__':unittest.main(verbosity=2)
