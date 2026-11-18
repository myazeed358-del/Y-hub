// Real React/CSS; fixture HTTP. SQL/Auth suites verify server bounds and access.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {sheetsFixture} from './y-sheets-browser-fixture.mjs';
const {chromium}=await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('/workspace/sheets-library-screenshots',{recursive:true});
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  const language=theme==='dark'?'ar':'en',t=(en,ar)=>language==='ar'?ar:en;
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language}),page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  const file=[...state.rows.values()][0],folder='00000000-0000-4000-8000-000000000070';
  file.content={id:file.id,name:file.name,activeSheetId:'s',sheets:[{id:'s',name:t('Saved inputs','مدخلات محفوظة'),cells:{'0,0':{raw:'=2+3',computed:5},'0,1':{raw:'<img src=x onerror=alert(1)>'},'1,0':{raw:'قيمة محفوظة'},'2,2':{raw:'x'.repeat(400)}}}]};
  state.folders.set(folder,{kind:'folder',id:folder,name:'0 Course folder',parent_id:null,organization_revision:1,revision:null,favorite:false,pinned:false,updated_at:new Date().toISOString()});
  await page.goto(new URL('/y-sheets',base).href);const card=()=>page.getByRole('article',{name:file.name,exact:true});await card().waitFor();assert.equal(state.previewRequests,0);
  await card().getByRole('button',{name:t('Preview','معاينة'),exact:true}).click();const preview=()=>page.getByRole('region',{name:t('Saved cell preview','معاينة الخلايا المحفوظة'),exact:true});await preview().getByText('=2+3',{exact:true}).waitFor();assert.equal(await preview().locator('td').count(),24);assert.equal(await preview().locator('img,a').count(),0);assert.equal(await preview().getByText('<img src=x onerror=alert(1)>',{exact:true}).count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await preview().screenshot({path:`/workspace/sheets-library-screenshots/${width}-${theme}-${language}.png`});await preview().getByRole('button',{name:t('Close preview','إغلاق المعاينة'),exact:true}).click();
  const classify=async(name,label)=>{await page.getByRole('article',{name,exact:true}).getByRole('button',{name:t('Classify','تصنيف'),exact:true}).click();const form=page.getByRole('form',{name:t('Classify item','تصنيف العنصر'),exact:true});await form.getByLabel(t('Item category','تصنيف العنصر'),{exact:true}).fill(label);await form.getByRole('button',{name:t('Save category','حفظ التصنيف'),exact:true}).click();await form.waitFor({state:'detached'});};
  await classify(file.name,'Course');await classify('0 Course folder','Course');assert.equal(state.categories.get(`workbook:${file.id}`).category,'Course');assert.equal(file.revision,1);
  await page.getByLabel(t('Category filter','تصفية حسب التصنيف'),{exact:true}).fill('course');await page.getByRole('button',{name:t('Filter category','تصفية التصنيف'),exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ys-file-card').length===2);
  await page.getByRole('button',{name:t('Unclassified','غير مصنف'),exact:true}).click();await card().waitFor({state:'detached'});await page.getByRole('button',{name:t('All categories','جميع التصنيفات'),exact:true}).click();await card().waitFor();
  await page.getByRole('button',{name:'All files list',exact:true}).click();await card().getByRole('button',{name:t('Preview','معاينة'),exact:true}).click();await preview().getByText('=2+3',{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await preview().getByRole('button',{name:t('Close preview','إغلاق المعاينة'),exact:true}).click();
  file.revision++;await card().getByRole('button',{name:t('Preview','معاينة'),exact:true}).click();await preview().getByRole('alert').waitFor();assert.equal(await preview().locator('table').count(),0);
  await page.getByRole('button',{name:t('Refresh files','تحديث الملفات'),exact:true}).click();await card().waitFor();await card().getByRole('button',{name:t('Preview','معاينة'),exact:true}).click();await preview().getByText('=2+3',{exact:true}).waitFor();
  state.denied=true;await page.getByRole('button',{name:t('Refresh files','تحديث الملفات'),exact:true}).click();await page.getByRole('alert').filter({hasText:t('Directory unavailable','تعذر الوصول')}).waitFor();assert.equal(await page.getByRole('article').count(),0);assert.equal(await page.getByText('=2+3',{exact:true}).count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${width}/${theme}/${language}: on-demand raw preview, escaped markup, file/folder categories, filters, grid/list, revision conflict and access denial.`);await context.close();
 }
}finally{await browser.close();}
