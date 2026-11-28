// Real React/editor/CSS, fixture HTTP. Native authorization is tested separately.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {sheetsFixture} from './y-sheets-browser-fixture.mjs';
const {chromium}=await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('/workspace/sheets-sharing-screenshots',{recursive:true});
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const language=theme==='dark'?'ar':'en',t=(en,ar)=>language==='ar'?ar:en;
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  const id='00000000-0000-4000-8000-000000000033',sheet='sheet';
  state.incoming.set(id,{permission:'view',grantRevision:1,revision:1,workbook:{id,name:'Confidential shared file',version:1,activeSheetId:sheet,sheets:[{id:sheet,name:'Sheet 1',rowCount:100,colCount:26,cells:{'0,0':{raw:'Confidential value',computed:'Confidential value'}},columnWidths:{},rowHeights:{},mergedCells:[],conditionalFormats:[],validations:{}}]}});
  await page.goto(new URL('/y-sheets',base).href);
  const own=page.getByRole('article',{name:'Archive 00',exact:true});await own.waitFor();
  await own.getByRole('button',{name:t('Share','مشاركة'),exact:true}).click();
  const panel=page.getByRole('region',{name:t('File sharing','مشاركة الملف')});await panel.getByLabel(t('Y-Hub number','رقم Y-Hub'),{exact:true}).fill('123456789');
  await panel.getByRole('button',{name:t('Find account','العثور على الحساب'),exact:true}).click();await panel.getByText('Selected recipient',{exact:true}).waitFor();assert.equal(state.grants.size,0);
  await panel.getByRole('button',{name:t('Confirm sharing with this account','تأكيد المشاركة مع هذا الحساب'),exact:true}).click();
  const access=panel.getByLabel(t('Permission for','صلاحية')+' 123456789');await access.waitFor();assert.equal([...state.grants.values()][0].permission,'view');
  await access.selectOption('edit');await page.waitForTimeout(100);await access.selectOption('none');await page.waitForTimeout(100);
  assert.equal([...state.grants.values()][0].permission,'none');assert.equal([...state.grants.values()][0].revision,3);
  await panel.getByRole('button',{name:t('Close sharing','إغلاق المشاركة'),exact:true}).click();
  const open=()=>page.getByRole('region',{name:t('Shared with me','تمت مشاركتها معي')}).getByRole('button',{name:/Confidential shared file/}).click();
  await open();const formula=page.getByPlaceholder(/Enter a value or formula/);await formula.waitFor();assert.equal(await formula.getAttribute('readonly'),'');assert.equal(await formula.inputValue(),'Confidential value');
  assert.equal(await page.getByLabel('Workbook name',{exact:true}).getAttribute('readonly'),'');
  await page.getByRole('tab',{name:'File',exact:true}).click();assert(await page.getByRole('button',{name:'New workbook',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Export workbook',exact:true}).click();await page.getByText(/Export.*not permitted/i).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:t('Back to my files','العودة إلى ملفاتي'),exact:true}).click();
  const remote=state.incoming.get(id);remote.permission='edit';remote.grantRevision=2;
  await open();await formula.waitFor();await formula.fill('=2+3');await formula.press('Enter');await page.locator('[data-shared-save="saved"]').waitFor();assert.equal(remote.revision,2);assert.equal(remote.workbook.sheets[0].cells['0,0'].computed,5);
  assert.equal(await page.evaluate(()=>Object.entries(localStorage).some(([key,value])=>key.includes('recovery')||value.includes('Confidential shared file'))),false);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/workspace/sheets-sharing-screenshots/${width}-${theme}-${language}.png`});
  remote.permission='none';remote.grantRevision=3;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('alert').filter({hasText:t('Shared access could not','تعذر التحقق')}).waitFor();assert.equal(await formula.count(),0);
  await page.getByRole('button',{name:t('Back to my files','العودة إلى ملفاتي'),exact:true}).click();
  remote.permission='edit';remote.grantRevision=4;await page.getByRole('button',{name:t('Refresh shared files','تحديث المشاركات'),exact:true}).click();await open();await formula.waitFor();await formula.fill('unsaved secret');await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await page.getByRole('alert').filter({hasText:t('Shared access could not','تعذر التحقق')}).waitFor();assert.equal(await formula.count(),0);assert.equal(remote.workbook.sheets[0].cells['0,0'].raw,'=2+3');
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('unsaved secret'))),false);assert.deepEqual(errors,[]);
  console.log(`PASS ${width}/${theme}/${language}: exact recipient confirmation, grant/change/revoke, viewer, edit, export blocked, revocation and offline purge without recovery.`);await context.close();
 }
}finally{await browser.close();}
