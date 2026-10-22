import json,unittest
from concurrent.futures import ThreadPoolExecutor
from support import run,value,I,A,S,U,O
from test_engine_grants import setup,student,grant

def read(u):return json.loads(value('SELECT public.read_quick_access()',u))
def save(u,rev,paths):
 array='ARRAY['+','.join("'"+p+"'" for p in paths)+']::text[]'
 return value(f'SELECT public.save_quick_access({rev},{array})',u)
class QuickAccess(unittest.TestCase):
 def test_defaults_empty_selection_and_order(self):
  u=student();s=read(u);self.assertEqual(s['revision'],0)
  self.assertEqual(save(u,0,[]),'1');self.assertEqual(read(u)['paths'],[])
  options=[a['path'] for a in s['available']][:3][::-1]
  save(u,1,options);self.assertEqual(read(u)['paths'],options)
 def test_validation_and_forbidden_routes(self):
  u=student();p=read(u)['available'][0]['path']
  for paths in [[p,p],[p]*4,['/engine-access'],['/unknown']]:
   with self.assertRaises(AssertionError):save(u,0,paths)
  self.assertEqual(read(u)['revision'],0)
 def test_user_and_role_isolation(self):
  u=student();v=student();save(u,0,[])
  self.assertEqual(value(f"SELECT count(*) FROM public.student_quick_access WHERE id='{u}'",v),'0')
  for actor in [I,A,S,O]:
   with self.assertRaises(AssertionError):read(actor)
   with self.assertRaises(AssertionError):save(actor,0,[])
  for actor in [u,A,S]:
   self.assertNotEqual(run(f"UPDATE public.student_quick_access SET paths='{{}}' WHERE id='{u}'",actor,False).returncode,0)
   self.assertNotEqual(run(f"DELETE FROM public.student_quick_access WHERE id='{u}'",actor,False).returncode,0)
 def test_two_devices_cas_and_lost_ack(self):
  u=student()
  with ThreadPoolExecutor(2) as pool:
   results=list(pool.map(lambda _:run('SELECT public.save_quick_access(0,ARRAY[]::text[])',u,False),range(2)))
  self.assertEqual(sum(r.returncode==0 for r in results),1)
  self.assertEqual(read(u)['revision'],1)
  with self.assertRaises(AssertionError):save(u,0,[])
  self.assertEqual(read(u)['paths'],[])
 def test_revoked_engine_disappears_without_erasing_other_tools(self):
  c,u=setup();g=grant(c,u);s=read(u)
  engine=next(a['path'] for a in s['available'] if a['moduleId']=='linear-algebra')
  app=next(a['path'] for a in s['available'] if a['moduleId']=='y-sheets')
  save(u,0,[engine,app]);value(f"SELECT public.revoke_engine_access('{g}')",I)
  self.assertEqual(read(u)['paths'],[app])
  with self.assertRaises(AssertionError):save(u,1,[engine])
