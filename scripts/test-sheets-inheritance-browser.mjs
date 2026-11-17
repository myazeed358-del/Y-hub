// React UI with fixture HTTP; real inherited authorization is tested in PostgreSQL/JWT suites.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {sheetsFixture} from './y-sheets-browser-fixture.mjs';
const {chromium}=await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('/workspace/sheets-inheritance-screenshots',{recursive:true});
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const language=theme==='dark'?'ar':'en',t=(en,ar)=>language==='ar'?ar:en;
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  const folder='00000000-0000-4000-8000-000000000077',file=[...state.rows.values()][0];
  state.folders.set(folder,{kind:'folder',id:folder,name:'0 Course',parent_id:null,organization_revision:1,revision:null,favorite:false,pinned:false,updated_at:new Date().toISOString()});
  await page.goto(new URL('/y-sheets',base).href);
  const row=page.getByRole('article',{name:'0 Course',exact:true});await row.waitFor();await row.getByRole('button',{name:t('Share','مشاركة'),exact:true}).click();
  const panel=page.getByRole('region',{name:t('Folder sharing','مشاركة المجلد')});
  await panel.getByLabel(t('Y-Hub number','رقم Y-Hub'),{exact:true}).fill('123456789');await panel.getByRole('button',{name:t('Find account','العثور على الحساب'),exact:true}).click();await panel.getByText('Selected recipient',{exact:true}).waitFor();
  let warning='';page.once('dialog',async d=>{warning=d.message();await d.dismiss();});
  await panel.getByRole('button',{name:t('Confirm sharing with this account','تأكيد المشاركة مع هذا الحساب'),exact:true}).click();assert.equal(state.folderGrants.size,0);assert.match(warning,language==='ar'?/الحالية والمستقبلية/:/current and future/);
  page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:t('Confirm sharing with this account','تأكيد المشاركة مع هذا الحساب'),exact:true}).click();
  const permission=panel.getByLabel(t('Permission for','صلاحية')+' 123456789');await permission.waitFor();assert.equal(state.folderGrants.get(folder).permission,'view');
  page.once('dialog',d=>d.accept());await permission.selectOption('edit');await page.waitForTimeout(150);assert.equal(state.folderGrants.get(folder).permission,'edit');
  await page.screenshot({path:`/workspace/sheets-inheritance-screenshots/${width}-${theme}-${language}.png`,fullPage:true});
  page.once('dialog',d=>d.accept());await permission.selectOption('none');await page.waitForTimeout(150);assert.equal(state.folderGrants.get(folder).permission,'none');
  await panel.getByRole('button',{name:t('Close sharing','إغلاق المشاركة'),exact:true}).click();
  state.inherited.set(file.id,[{id:'00000000-0000-4000-8000-000000000022',number:'123456789',name:'Selected recipient',permission:'view',folderId:folder,folderName:'Source course'}]);
  const fileRow=page.getByRole('article',{name:file.name,exact:true});await fileRow.getByRole('button',{name:t('Share','مشاركة'),exact:true}).click();
  const inherited=page.getByRole('region',{name:t('Inherited access','الوصول الموروث'),exact:true});await inherited.getByText('Source course',{exact:true}).waitFor();assert.equal(await inherited.locator('select').count(),0);
  await page.getByRole('button',{name:t('Close sharing','إغلاق المشاركة'),exact:true}).click();
  await fileRow.getByRole('button',{name:t('Move','نقل'),exact:true}).click();await row.locator('.ys-file-open').click();
  const move=page.getByRole('button',{name:t('Move here','نقل إلى هنا'),exact:true});
  page.once('dialog',async d=>{warning=d.message();await d.dismiss();});await move.click();assert.equal(state.locations.has(file.id),false);assert.match(warning,language==='ar'?/المشاركات المباشرة/:/direct shares/);
  page.once('dialog',d=>d.accept());await move.click();await page.waitForTimeout(150);assert.equal(state.locations.get(file.id).parent_id,folder);
  assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
  console.log(`PASS ${width}/${theme}/${language}: folder warning cancel/confirm, view/edit/revoke, separate inherited source, move warning cancel/confirm.`);await context.close();
 }
}finally{await browser.close();}
