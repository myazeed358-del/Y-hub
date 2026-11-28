// React/CSS with fixture HTTP; PostgreSQL/JWT suites prove actual storage/authorization.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {sheetsFixture} from './y-sheets-browser-fixture.mjs';
const {chromium}=await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('/workspace/sheets-trash-screenshots',{recursive:true});
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const language=theme==='dark'?'ar':'en',t=(en,ar)=>language==='ar'?ar:en;
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  const root='00000000-0000-4000-8000-000000000070',child='00000000-0000-4000-8000-000000000071',file=[...state.rows.values()][0];
  for(const [id,name,parent] of [[root,'0 Deleted course',null],[child,'Nested folder',root]])state.folders.set(id,{id,name,kind:'folder',parent_id:parent,organization_revision:1,revision:null,favorite:false,pinned:false,updated_at:new Date().toISOString()});
  state.locations.set(file.id,{parent_id:child,favorite:false,pinned:false,organization_revision:1});
  state.folderGrants.set(root,{id:'00000000-0000-4000-8000-000000000022',number:'123456789',name:'Selected recipient',permission:'edit',revision:1});
  await page.goto(new URL('/y-sheets',base).href);
  const card=()=>page.getByRole('article',{name:'0 Deleted course',exact:true});await card().waitFor();
  let warning='';page.once('dialog',async d=>{warning=d.message();await d.dismiss();});await card().getByRole('button',{name:t('Delete','حذف'),exact:true}).click();assert.equal(state.trash.size,0);assert.match(warning,/30/);
  page.once('dialog',d=>d.accept());await card().getByRole('button',{name:t('Delete','حذف'),exact:true}).click();await card().waitFor({state:'detached'});assert.equal(state.rows.has(file.id),false);
  await page.getByRole('button',{name:t('Open trash','فتح السلة'),exact:true}).click();const panel=()=>page.getByRole('region',{name:t('Trash','سلة المحذوفات'),exact:true});await panel().getByText('0 Deleted course',{exact:true}).waitFor();
  assert.equal(await panel().locator('time').count(),1);await page.screenshot({path:`/workspace/sheets-trash-screenshots/${width}-${theme}-${language}.png`,fullPage:true});
  page.once('dialog',d=>d.dismiss());await panel().getByRole('button',{name:t('Restore privately','استعادة خاصة'),exact:true}).click();assert.equal(state.rows.has(file.id),false);
  state.failRestore=true;page.once('dialog',d=>d.accept());await panel().getByRole('button',{name:t('Restore privately','استعادة خاصة'),exact:true}).click();await panel().getByRole('alert').waitFor();assert.equal(state.rows.has(file.id),false);
  state.failRestore=false;await panel().getByRole('button',{name:t('Refresh trash','تحديث السلة'),exact:true}).click();await panel().getByText('0 Deleted course',{exact:true}).waitFor();
  page.once('dialog',async d=>{warning=d.message();await d.accept();});await panel().getByRole('button',{name:t('Restore privately','استعادة خاصة'),exact:true}).click();await card().waitFor();await panel().getByText(t('Trash is empty.','سلة المحذوفات فارغة.'),{exact:true}).waitFor();
  assert.match(warning,language==='ar'?/بشكل خاص/:/privately/);assert.equal(state.folders.get(root).parent_id,null);assert.equal(state.folders.get(child).parent_id,root);assert.equal(state.locations.get(file.id).parent_id,child);assert.equal(state.rows.get(file.id).revision,2);assert.equal(state.folderGrants.get(root).permission,'none');
  await panel().getByRole('button',{name:t('Close trash','إغلاق السلة'),exact:true}).click();page.once('dialog',d=>d.accept());await card().getByRole('button',{name:t('Delete','حذف'),exact:true}).click();await card().waitFor({state:'detached'});
  await page.getByRole('button',{name:t('Open trash','فتح السلة'),exact:true}).click();await panel().getByText('0 Deleted course',{exact:true}).waitFor();
  page.once('dialog',d=>d.dismiss());await panel().getByRole('button',{name:t('Delete permanently','حذف نهائي'),exact:true}).click();assert([...state.trash.values()].some(e=>e.state==='trashed'));
  page.once('dialog',d=>d.accept());await panel().getByRole('button',{name:t('Delete permanently','حذف نهائي'),exact:true}).click();await panel().getByText(t('Trash is empty.','سلة المحذوفات فارغة.'),{exact:true}).waitFor();assert.equal([...state.trash.values()].filter(e=>e.state==='trashed').length,0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
  console.log(`PASS ${width}/${theme}/${language}: subtree trash, cancel/confirm, expiry display, restore failure/retry, private tree restore, revoked sharing, permanent purge.`);await context.close();
 }
}finally{await browser.close();}
