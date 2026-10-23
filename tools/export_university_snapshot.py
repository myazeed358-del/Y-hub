"""Export pinned independent work into a disposable source tree; never merge Git."""
import io,subprocess,sys,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='8a5dde1b20f26161e7e26b8b0bf71ecd1097f136'
PHASE3=['56e5e3303e66a759336ec9a6ad2f474ea1ee4941','a9a814ef1e4b2a427d0357d18cdf79cfa83b9274','caec7a29a11455b2ca2a242aa7dcde0dae865b92','fa9c7e3d5d8cd38f0644a207f78703f24a9f3b3c']
ENGINE='db0ae2d7b57efee2ed85621d8a3e9f2488abda02'
QUICK='f862ae29b547940dfe1790a9d9f14f63b35d6b3f'
OWNER='b150fddc6cae053e9aa765ac5f3905b5d7156ffe'
# These four exact test inventories are additive changes on both independent branches.
INVENTORIES={
 'artifacts/y-hub/src/modules/__tests__/registry.test.ts',
 'artifacts/y-hub/src/routing/__tests__/AppRoutes.test.tsx',
 'artifacts/y-hub/src/components/layout/__tests__/navigation.test.ts',
 'artifacts/y-hub/src/features/app-shell/__tests__/navigationRoutes.test.ts',
}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def extract(ref,destination,paths=None):
 args=['archive',ref]+(['--',*paths] if paths is not None else [])
 with tarfile.open(fileobj=io.BytesIO(git(*args))) as archive:archive.extractall(destination,filter='data')
def overlay(base,ref,destination,exclude=()):
 paths=git('diff','--name-only',base,ref,'--','artifacts','scripts').decode().splitlines()
 paths=[p for p in paths if p not in exclude]
 if paths:extract(ref,destination,paths)
 print('Exported independent source:',ref,flush=True)
def main():
 destination=Path(sys.argv[1]).resolve()
 if not str(destination).startswith('/tmp/yhub-university-verify.') or any(destination.iterdir()):raise SystemExit('Requires an empty disposable verification directory')
 extract('HEAD',destination)
 for ref in PHASE3:overlay(BASE,ref,destination,INVENTORIES)
 overlay(ENGINE,QUICK,destination);overlay(BASE,OWNER,destination)
 for path in INVENTORIES:
  file=destination/path;text=file.read_text()
  if 'registry.test' in path or 'AppRoutes.test' in path:
   assert "'/audit-log'," in text;text=text.replace("'/audit-log',","'/academic-management', '/audit-log',",1)
  else:
   assert "'/engine-access'," in text;text=text.replace("'/engine-access',","'/academic-management', '/engine-access',")
  file.write_text(text)
 # Frontend cross-branch integration tests are only compiled in this composed snapshot.
 fixture=ROOT/'tools/university-tests/quickAccessEditor.test.tsx'
 target=destination/'artifacts/y-hub/src/features/student-dashboard/__tests__/quickAccessEditor.test.tsx'
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(fixture.read_text())
 (destination/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 for name in ['y-hub','y-hub-ds','mockup-sandbox']:
  (destination/'artifacts'/name/'node_modules').symlink_to(ROOT/'artifacts'/name/'node_modules',target_is_directory=True)
 print('Source snapshot ready; no branch merge or production connection',flush=True)
if __name__=='__main__':main()
