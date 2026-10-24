// Optional real-browser complement to Vitest. Never authenticates or contacts Supabase.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.YHUB_PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath ? pathToFileURL(modulePath).href : 'playwright-core');
const base=new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['127.0.0.1','localhost'].includes(base.hostname),'Use a local test server only.');
const browser=await chromium.launch({executablePath:process.env.YHUB_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route('https://**/*',route=>route.abort());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('/src/features/y-sheets/test/browser-harness.html',base).href);
  const formula=page.getByPlaceholder(/Enter a value or formula/);
  await formula.fill('=1+2');
  assert.equal(await page.evaluate(()=>window.draft?.raw),'=1+2');
  await formula.press('Enter');
  await page.waitForFunction(()=>window.saved?.sheets[0].cells['0,0']?.computed===3);
  assert.deepEqual(await page.evaluate(()=>window.excelSmoke()),{raw:'=1+2',computed:3});
  assert.equal(await page.locator('#host').evaluate(e=>getComputedStyle(e).display),'grid');
  await page.getByTitle('Switch to Dark Mode').click();
  assert.equal(await page.locator('.y-sheets-root.dark').count(),1);
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:844});
    await page.locator('[data-y-sheets-scroll]').evaluate(e=>{e.scrollLeft=0;e.scrollTop=0;});
    await page.waitForTimeout(100);
    const cell=page.locator('[data-y-sheets-cell="0,0"]');
    assert.equal(await cell.innerText(),'3');
    assert(await cell.evaluate(e=>{
      const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),'A1 must be visible, not covered by column headers');
    await page.getByRole('tab',{name:'File',exact:true}).click();
    const controls=await page.getByRole('button',{name:'Export workbook',exact:true}).boundingBox();
    assert(controls && controls.x+controls.width<=width,'Export must be accessible on mobile');
    assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=width,'No document overflow');
    await page.locator('[data-y-sheets-scroll]').evaluate(e=>{e.scrollLeft=120;e.scrollTop=120;});
    await page.waitForTimeout(100);
    const c=await page.locator('[data-y-sheets-cell="6,2"]').boundingBox();
    const column=await page.locator('[data-y-sheets-column="2"]').boundingBox();
    const row=await page.locator('[data-y-sheets-row="6"]').boundingBox();
    assert(c && column && row);
    assert(Math.abs(c.x-column.x)<1,'Column header must follow horizontal cell scrolling');
    assert(Math.abs(c.y-row.y)<1,'Row header must follow vertical cell scrolling');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: Chromium formula/draft, real Excel worker, host CSS/theme, desktop/mobile controls and grid alignment before/after scroll.');
} finally {await browser.close();}
