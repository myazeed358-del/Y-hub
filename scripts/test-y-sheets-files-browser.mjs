// Real app + Chromium with synthetic, isolated HTTP fixtures; never production.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readFile,mkdir} from 'node:fs/promises';
import {sheetsFixture} from './y-sheets-browser-fixture.mjs';
const {chromium}=await import(process.env.YHUB_PLAYWRIGHT_MODULE?pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href:'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL||'http://127.0.0.1:5175');
assert(['127.0.0.1','localhost'].includes(base.hostname));
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
await mkdir('/tmp/yhub-sheets-review-screenshots',{recursive:true});
try {
 for(const width of [1280,390])for(const theme of ['light','dark']){
  const language=theme==='dark'?'ar':'en';
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language});
  const page=await context.newPage();const errors=[],consoleErrors=[];let answer;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('dialog',async d=>{if(d.type()==='beforeunload')return d.accept();assert.notEqual(answer,undefined,'Unexpected dialog: '+d.message());const value=answer;answer=undefined;return value===false?d.dismiss():d.accept(typeof value==='string'?value:undefined);});
  const saved=()=>page.locator('[data-save-status="saved"]').waitFor();
  await page.goto(new URL('/y-sheets',base).href);
  await page.getByRole('button',{name:'New Workbook',exact:true}).waitFor();
  assert.equal(await page.locator('aside').count(),0);
  await page.getByRole('button',{name:'All files list',exact:true}).click();
  await page.getByRole('button',{name:'Load more files'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.ys-file-card').length===51);
  assert(state.offsets.includes(50));
  const time=page.locator('time').first();assert.equal(await time.innerText(),new Intl.DateTimeFormat(language==='ar'?'ar-JO':'en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).format(new Date('2026-01-01T00:00:00Z')));
  await page.getByRole('textbox',{name:'Search workbooks'}).or(page.getByRole('searchbox',{name:'Search workbooks'})).fill('Review');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.ys-file-card').length===0);
  answer='Review workbook';await page.getByRole('button',{name:'New Workbook',exact:true}).click();
  const formula=page.getByPlaceholder(/Enter a value or formula/);await formula.waitFor();
  assert.equal(await page.locator('header').count(),0);assert.equal(await page.getByRole('button',{name:'My Files',exact:true}).count(),1);
  const id=[...state.rows.values()].find(r=>r.name==='Review workbook').id;
  state.loseAck=true;await formula.fill('=2+3');await formula.press('Enter');await saved();
  assert.equal(state.rows.get(id).content.sheets[0].cells['0,0'].computed,5);assert.equal(state.rows.get(id).revision,2);
  const home=page.getByRole('tab',{name:'Home',exact:true});await home.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'Insert'}).getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Add worksheet',exact:true}).click();
  const options=page.getByRole('button',{name:'Options for worksheet Sheet2'});await options.focus();await options.press('Enter');
  await page.getByRole('button',{name:'Rename',exact:true}).click();await page.getByRole('textbox',{name:'Worksheet name',exact:true}).fill('Review tab');await page.getByRole('textbox',{name:'Worksheet name',exact:true}).press('Enter');
  await page.getByText('Sheet 1',{exact:true}).click();await saved();
  await page.getByRole('button',{name:'My Files',exact:true}).click();
  await page.getByRole('button',{name:'More options for Review workbook',exact:true}).click();answer='Review renamed';await page.getByRole('button',{name:'Rename',exact:true}).click();
  await page.locator('.ys-file-open').filter({hasText:'Review renamed'}).click();await formula.waitFor();
  assert.equal(await formula.inputValue(),'=2+3');assert.equal(state.rows.get(id).content.sheets[1].name,'Review tab');
  await formula.fill('=99');await page.reload();await page.getByRole('button',{name:'Recover',exact:true}).click();await formula.waitFor();await saved();assert.equal(await formula.inputValue(),'=99');
  // Simulate another device advancing the same revision before this editor saves.
  const remote=state.rows.get(id);remote.revision++;remote.content.sheets[0].cells['0,0']={raw:'202',computed:202};
  await formula.fill('=101');await formula.press('Enter');await page.locator('[data-save-status="conflict"]').waitFor();
  await page.getByRole('button',{name:'My Files',exact:true}).click();assert.equal(await formula.inputValue(),'=101');
  await page.getByRole('button',{name:'Keep recovery',exact:true}).click();await page.getByRole('button',{name:'Recover',exact:true}).waitFor();
  const recoveryDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();assert((await readFile(await (await recoveryDownload).path(),'utf8')).includes('=101'));
  await page.getByRole('button',{name:'Recover',exact:true}).click();await page.locator('[data-save-status="conflict"]').waitFor();
  answer='Review recovered copy';await page.getByRole('button',{name:'Save as copy',exact:true}).click();await saved();assert.equal(await formula.inputValue(),'=101');assert.equal(state.rows.get(id).content.sheets[0].cells['0,0'].raw,'202');
  const copy=[...state.rows.values()].find(r=>r.name==='Review recovered copy');assert(copy && copy.id!==id);
  // Exercise existing import/export through the correct Ribbon panel and keyboard.
  await page.getByRole('tab',{name:'File',exact:true}).click();await page.getByRole('button',{name:'Import Excel or CSV'}).click();
  answer=true;await page.locator('input[type="file"]').setInputFiles({name:'review.csv',mimeType:'text/csv',buffer:Buffer.from('Item,Value\nA,7')});await saved();
  assert.equal(state.rows.get(copy.id).content.id,copy.id);
  await page.getByRole('button',{name:'Export workbook'}).click();const backup=page.getByRole('button',{name:/Y-Sheets Backup/});await backup.focus();const exportDownload=page.waitForEvent('download');await backup.press('Enter');assert((await readFile(await (await exportDownload).path(),'utf8')).includes('Item'));
  // JSON export closes its own dialog after the download is prepared.
  await page.getByRole('button',{name:'My Files',exact:true}).click();
  const deleteCopy=async()=>{await page.getByRole('button',{name:'More options for Review recovered copy',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();};
  answer=false;await deleteCopy();assert(state.rows.has(copy.id));
  state.failDelete=true;answer=true;await deleteCopy();await page.getByRole('alert').filter({hasText:'Delete was not confirmed'}).waitFor();assert(state.rows.has(copy.id));
  state.failDelete=false;answer=true;await deleteCopy();await page.waitForFunction(()=>![...document.querySelectorAll('.ys-file-open')].some(e=>e.textContent.includes('Review recovered copy')));assert(!state.rows.has(copy.id));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/yhub-sheets-review-screenshots/files-${theme}-${width}.png`});
  assert.deepEqual(errors,[]);assert(consoleErrors.every(e=>/Failed to load resource.*(?:409|503)|net::ERR_FAILED/.test(e)),JSON.stringify(consoleErrors));
  console.log(`PASS: ${width}/${theme}/${language}: pagination, search, create, save/lost-ack, sheet rename, file rename, reload recovery, conflict copy, import/export, confirmed delete/failure; no unhandled page errors.`);
  await context.close();
 }
} finally {await browser.close();}
