import io,os,sys,unittest,urllib.error
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from python.api.server import app
from python.api.authorization import verify_compute
from fastapi import HTTPException
class EngineAuthorization(unittest.TestCase):
 def setUp(self):
  self.env=patch.dict(os.environ,{'SUPABASE_URL':'https://local.invalid','SUPABASE_ANON_KEY':'public-fixture'});self.env.start();self.addCleanup(self.env.stop)
 def test_missing_bearer_denied_before_network_and_math(self):
  with patch('python.api.authorization.urllib.request.urlopen') as network:
   r=TestClient(app).post('/api/v1/math/compute',json={'phase':'10'})
   self.assertEqual(r.status_code,401);network.assert_not_called()
 def test_authorization_false_and_unknown_scope_are_denied(self):
  with patch('python.api.authorization.urllib.request.urlopen') as network:
   network.return_value.__enter__.return_value.read.return_value=b'false'
   with self.assertRaises(HTTPException) as error:verify_compute('Bearer fixture','phase','unknown')
   self.assertEqual(error.exception.status_code,403)
   self.assertIn(b'"p_scope": "unknown"',network.call_args.args[0].data)
 def test_expired_jwt_status_propagates_without_claim_trust(self):
  with patch('python.api.authorization.urllib.request.urlopen',side_effect=urllib.error.HTTPError('https://local.invalid',401,'expired',{},io.BytesIO())):
   with self.assertRaises(HTTPException) as error:verify_compute('Bearer expired','phase','10')
   self.assertEqual(error.exception.status_code,401)
 def test_rpc_failure_and_unconfigured_server_fail_closed(self):
  for failure in [OSError('offline'),ValueError('invalid JSON')]:
   with patch('python.api.authorization.urllib.request.urlopen',side_effect=failure):
    with self.assertRaises(HTTPException) as error:verify_compute('Bearer fixture','phase','10')
    self.assertEqual(error.exception.status_code,503)
  with patch.dict(os.environ,{'SUPABASE_URL':'http://untrusted.invalid'}):
   with self.assertRaises(HTTPException) as error:verify_compute('Bearer fixture','phase','10')
   self.assertEqual(error.exception.status_code,503)
 def test_every_compute_rechecks_current_grants_without_cached_allow(self):
  with patch('python.api.authorization.urllib.request.urlopen') as network:
   network.return_value.__enter__.return_value.read.side_effect=[b'true',b'false']
   verify_compute('Bearer same-token','phase','10')
   with self.assertRaises(HTTPException) as error:verify_compute('Bearer same-token','phase','10')
   self.assertEqual(error.exception.status_code,403);self.assertEqual(network.call_count,2)
 def test_ast_backend_has_same_http_boundary(self):
  root=Path(__file__).resolve().parents[4];sys.path.insert(0,str(root/'python_math_service'))
  from app.main import app as ast_app
  with patch('python.api.authorization.urllib.request.urlopen') as network:
   r=TestClient(ast_app).post('/api/v1/math/compute',json={'operation':'derive'})
   self.assertEqual(r.status_code,401);network.assert_not_called()

 def test_browser_auth_preflight_accepts_only_configured_origins(self):
  client=TestClient(app)
  headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}
  response=client.options('/api/v1/math/compute',headers=headers)
  self.assertEqual(response.status_code,200);self.assertIn('Authorization',response.headers['access-control-allow-headers'])
  response=client.options('/api/v1/math/compute',headers={**headers,'Origin':'https://untrusted.invalid'})
  self.assertEqual(response.status_code,400)
