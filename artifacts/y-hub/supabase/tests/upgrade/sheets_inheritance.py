from pathlib import Path
import subprocess,sys,unittest,json,uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'academic'))
from support import BASE,value,U,O
from test_sheets_folders import workbook,folder,organize
from test_sheets_sharing import share,read,save
class InheritanceUpgrade(unittest.TestCase):
 def test_existing_direct_grants_sessions_receipts_and_data_unchanged(self):
  revoked=workbook();share(revoked);share(revoked,'none',1)
  id=workbook();f=folder();organize(id,'workbook',parent=f);share(id)
  data=json.loads(read(id).stdout);request=str(uuid.uuid4());save(id,data['workbook'],request=request)
  tables=['public.y_sheets_workbooks','public.y_sheets_folders','y_sheets_private.locations','y_sheets_private.save_receipts','y_sheets_private.shared_receipts','y_sheets_private.shares','public.audit_events','public.audit_event_people']
  def snapshot(t):return value(f'SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM {t} r')
  before={t:snapshot(t) for t in tables}
  migration=Path(__file__).resolve().parents[2]/'migrations/20261117130556_sheets_inheritance.sql'
  result=subprocess.run(BASE,input=migration.read_text(),capture_output=True,text=True,timeout=30);self.assertEqual(result.returncode,0,result.stderr)
  for t in tables:self.assertEqual(snapshot(t),before[t],t)
  self.assertEqual(json.loads(read(id,grant=1).stdout)['permission'],'edit')
  self.assertEqual(save(id,data['workbook'],request=request).stdout.strip(),'2')
  self.assertEqual(value('SELECT count(*) FROM y_sheets_private.folder_shares'),'0')
  self.assertNotEqual(read(revoked,check=False).returncode,0)
if __name__=='__main__':unittest.main(verbosity=2)
