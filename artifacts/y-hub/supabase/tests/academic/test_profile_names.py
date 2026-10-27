"""Decision25: real isolated PostgreSQL signup trigger, ownership, completion and races."""
import json, uuid, unittest
from concurrent.futures import ThreadPoolExecutor
from support import run, value, I, A, S, U, O

def literal(data): return "'"+json.dumps(data,ensure_ascii=False).replace("'","''")+"'::jsonb"
def signup(metadata=None, check=True):
    uid=str(uuid.uuid4())
    metadata=metadata if metadata is not None else {'full_name_ar':'أحمد عبد الله','full_name_en':'Ahmad Abdullah'}
    return uid, run(f"INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('{uid}','local@example.invalid',{literal(metadata)})",check=check)
def legacy(role='student'):
    uid,_=signup()
    run(f"UPDATE public.users SET full_name_ar=NULL,full_name_en=NULL,full_name='Legacy unchanged',role='{role}' WHERE id='{uid}'")
    return uid
class ProfileNames(unittest.TestCase):
    def test_signup_requires_both_names_atomically(self):
        for metadata in [{},{'full_name_ar':'أحمد'},{'full_name_en':'Ahmad'},{'full_name_ar':22,'full_name_en':'Ahmad'}]:
            uid,result=signup(metadata,False)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(value(f"SELECT count(*) FROM auth.users WHERE id='{uid}'"),'0')
            self.assertEqual(value(f"SELECT count(*) FROM public.users WHERE id='{uid}'"),'0')
    def test_valid_signup_trims_and_ignores_forged_identity_role_number(self):
        uid,_=signup({'full_name_ar':' أحمد عبد الله ','full_name_en':' Ahmad Abdullah ','full_name':'Injected','role':'super_admin','user_number':'000000001'})
        row=json.loads(value(f"SELECT row_to_json(u) FROM public.users u WHERE id='{uid}'"))
        self.assertEqual((row['full_name_ar'],row['full_name_en'],row['full_name'],row['role']),('أحمد عبد الله','Ahmad Abdullah','أحمد عبد الله','student'))
        self.assertRegex(row['user_number'],r'^\d{9}$');self.assertNotEqual(row['user_number'],'000000001')
    def test_invalid_names_fail_server_validation(self):
        for ar,en in [(' ', 'Ahmad'),('أحمد',''),('Ahmad','Ahmad'),('أحمد','أحمد'),('<img>','Ahmad'),('أحمد\u202e','Ahmad'),('أحمد','a'*121),('أحمد','Ahmad12'),('أحمد','\nAhmad')]:
            _,result=signup({'full_name_ar':ar,'full_name_en':en},False)
            self.assertNotEqual(result.returncode,0,(ar,en))
    def test_old_profiles_remain_unmodified_by_migration(self):
        self.assertEqual(value(f"SELECT full_name_ar IS NULL AND full_name_en IS NULL FROM public.users WHERE id='{S}'"),'t')
    def test_completion_preserves_legacy_name_number_permissions_and_other_users(self):
        uid=legacy();before=value(f"SELECT jsonb_build_array(full_name,user_number,role,major) FROM public.users WHERE id='{uid}'")
        value("SELECT public.complete_own_profile_names('أحمد عبد الله','Ahmad Abdullah')",uid)
        self.assertEqual(value(f"SELECT jsonb_build_array(full_name,user_number,role,major) FROM public.users WHERE id='{uid}'"),before)
        self.assertEqual(value(f"SELECT full_name_ar IS NULL FROM public.users WHERE id='{S}'"),'t')
    def test_completion_for_each_role_and_idempotent_retry(self):
        for role in ['student','instructor','admin','super_admin']:
            uid=legacy(role)
            for _ in range(2):value("SELECT public.complete_own_profile_names('أحمد','Ahmad')",uid)
            self.assertEqual(value(f"SELECT full_name_en FROM public.users WHERE id='{uid}'"),'Ahmad')
    def test_partial_completion_needs_both_and_does_not_overwrite_saved_name(self):
        uid=legacy();run(f"UPDATE public.users SET full_name_ar='أحمد' WHERE id='{uid}'")
        self.assertNotEqual(run("SELECT public.complete_own_profile_names('خالد','Khaled')",uid,False).returncode,0)
        value("SELECT public.complete_own_profile_names(NULL,'Ahmad')",uid)
        self.assertNotEqual(run("SELECT public.complete_own_profile_names('أحمد','Changed')",uid,False).returncode,0)
        self.assertEqual(value(f"SELECT full_name_ar||'/'||full_name_en FROM public.users WHERE id='{uid}'"),'أحمد/Ahmad')
        other=legacy();self.assertNotEqual(run("SELECT public.complete_own_profile_names('أحمد',NULL)",other,False).returncode,0)
        self.assertEqual(value(f"SELECT full_name_ar IS NULL FROM public.users WHERE id='{other}'"),'t')
    def test_concurrent_completion_has_one_winner_no_mixed_names(self):
        uid=legacy()
        with ThreadPoolExecutor(2) as pool:
            results=list(pool.map(lambda pair:run(f"SELECT public.complete_own_profile_names('{pair[0]}','{pair[1]}')",uid,False),[('أحمد','Ahmad'),('خالد','Khaled')]))
        self.assertEqual(sorted(r.returncode==0 for r in results),[False,True])
        self.assertIn(value(f"SELECT full_name_ar||'/'||full_name_en FROM public.users WHERE id='{uid}'"),['أحمد/Ahmad','خالد/Khaled'])
    def test_direct_write_and_foreign_identity_are_denied(self):
        uid=legacy()
        for actor in [I,A,S,O,uid]:
            self.assertNotEqual(run(f"UPDATE public.users SET full_name_en='Changed' WHERE id='{uid}'",actor,False).returncode,0)
            self.assertNotEqual(run(f"SELECT public.update_own_profile('{{\"full_name_en\":\"Changed\"}}')",actor,False).returncode,0)
        self.assertNotEqual(run("SET LOCAL ROLE anon; SELECT public.complete_own_profile_names('أحمد','Ahmad')",check=False).returncode,0)
        self.assertNotEqual(run("SET LOCAL ROLE authenticated; SELECT public.complete_own_profile_names('أحمد','Ahmad')",check=False).returncode,0)
    def test_metadata_update_does_not_replace_names_or_escalate_role(self):
        uid,_=signup()
        run(f"UPDATE auth.users SET raw_user_meta_data={literal({'full_name_ar':'خالد','full_name_en':'Changed','role':'super_admin'})} WHERE id='{uid}'")
        self.assertEqual(value(f"SELECT full_name_en||'/'||role FROM public.users WHERE id='{uid}'"),'Ahmad Abdullah/student')
    def test_helpers_have_no_definer_privileges_and_rpc_has_fixed_search_path(self):
        self.assertEqual(value("SELECT prosecdef FROM pg_proc WHERE oid='public.valid_profile_name(text,text)'::regprocedure"),'f')
        self.assertEqual(value("SELECT proconfig::text FROM pg_proc WHERE oid='public.complete_own_profile_names(text,text)'::regprocedure"),'{"search_path=\\"\\""}')
