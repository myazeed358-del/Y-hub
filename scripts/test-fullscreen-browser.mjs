// Real application/router/CSS; synthetic HTTP fixtures. No request reaches Supabase.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.YHUB_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href : 'playwright-core');
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['127.0.0.1', 'localhost'].includes(base.hostname));
const browser = await chromium.launch({ executablePath: process.env.YHUB_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, email: 'synthetic@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const workbook = { id:'00000000-0000-4000-8000-000000000002', name:'Synthetic geometry fixture', version:1, activeSheetId:'s', sheets:[{id:'s',name:'Sheet 1',rowCount:100,colCount:26,cells:{},columnWidths:{},rowHeights:{},mergedCells:[],conditionalFormats:[],validations:{}}] };
const expires = Math.floor(Date.now()/1000) + 3600;
const token = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,aud:'authenticated',exp:expires})).toString('base64url')}.synthetic`;
const out = process.env.YHUB_SCREENSHOTS || '/tmp/yhub-phase2-screenshots';
await mkdir(out, { recursive:true });
try {
  for (const language of ['en','ar']) for (const theme of ['light','dark']) {
    const context = await browser.newContext();
    let conflict = false;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base.origin) return route.continue();
      const json = value => route.fulfill({ contentType:'application/json', body:JSON.stringify(value) });
      if (url.pathname === '/auth/v1/user') return json(user);
      if (url.pathname === '/rest/v1/users') return json({ ...user, role:'student', full_name:'Synthetic student', major:'mathematics' });
      if (url.pathname === '/rest/v1/y_sheets_workbooks') return json(url.searchParams.has('id')
        ? { id:workbook.id, name:workbook.name, content:workbook, revision:1 }
        : [{ id:workbook.id, name:workbook.name, updated_at:'2026-01-01T00:00:00Z', revision:1 }]);
      if (url.pathname === '/rest/v1/rpc/save_y_sheets_workbook') return conflict
        ? route.fulfill({ status:409, contentType:'application/json', body:JSON.stringify({code:'40001',message:'Synthetic conflict'}) }) : json(2);
      if (url.pathname.startsWith('/rest/v1/')) return json([]);
      return route.abort();
    });
    await context.addInitScript(({user,token,expires,language,theme}) => {
      localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token', JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:expires,expires_in:3600,token_type:'bearer',user}));
      localStorage.setItem('yhub-language',language); localStorage.setItem('theme',theme);
    },{user,token,expires,language,theme});
    const page = await context.newPage();
    const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    await page.goto(new URL('/dashboard', base).href);
    await page.waitForSelector('aside');
    // Link navigation enters the production guarded router and lazy module loader.
    await page.getByRole('link',{name:'Y-Sheets', exact:true}).click();
    await page.getByRole('button',{name:/^Synthetic geometry fixture/}).click();
    const back = page.getByRole('button',{name:'Back to Y-Hub',exact:true});
    const formula = page.getByPlaceholder(/Enter a value or formula/);
    await formula.waitFor();
    assert.equal(await page.locator('aside').count(),0);
    assert.equal(await page.locator('header.sticky').count(),0);
    if(theme==='dark') {
      assert.equal(await page.locator('[data-y-sheets-column="0"]').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(8, 51, 68, 0.8)');
      assert.equal(await page.locator('[data-y-sheets-cell="0,0"]').evaluate(e=>getComputedStyle(e).borderRightColor),'rgba(39, 39, 42, 0.8)');
    }
    for (const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844]]) {
      await page.setViewportSize({width,height});
      const grid = page.locator('[data-y-sheets-scroll]');
      await grid.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});
      const geometry = await page.evaluate(()=> {
        const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};
        return {frame:box('[data-layout="fullscreen"]'),grid:box('[data-y-sheets-scroll]'),formula:box('input[placeholder*="Enter a value"]'),scrollH:document.documentElement.scrollHeight,scrollW:document.documentElement.scrollWidth};
      });
      assert.equal(geometry.frame.h,height); assert.equal(geometry.frame.w,width);
      assert(geometry.grid.h>150,JSON.stringify(geometry));
      assert(geometry.grid.y>=geometry.formula.bottom);
      assert(geometry.grid.bottom<=height-30,'Sheet tabs/status must remain in viewport');
      assert(geometry.scrollH<=height && geometry.scrollW<=width,JSON.stringify(geometry));
      const backBox=await back.boundingBox(); assert(backBox && backBox.y>=0 && backBox.x>=0 && backBox.x+backBox.width<=width);
      await page.screenshot({path:`${out}/${language}-${theme}-${width}.png`});
      await grid.evaluate(e=>{e.scrollTop=150;e.scrollLeft=120;});
      assert(await grid.evaluate(e=>e.scrollTop>0 && e.scrollLeft>0));
    }
    // A draft cannot silently disappear on Back or an internal return button.
    await formula.fill('=42');
    page.once('dialog',dialog=>dialog.dismiss());
    await page.goBack();
    await page.waitForURL('**/y-sheets');
    assert.equal(await formula.inputValue(),'=42');
    // Clicking away commits the formula; failed persistence must keep the editor.
    conflict=true;
    await back.click();
    assert.equal(new URL(page.url()).pathname,'/y-sheets');
    await page.locator('[data-save-status="conflict"]').waitFor();
    page.once('dialog',dialog=>dialog.accept());
    await page.goBack();
    await page.waitForURL('**/dashboard'); await page.waitForSelector('aside');
    assert.equal(await page.locator('header.sticky').count(),1);
    assert(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('=42'))));
    await page.setViewportSize({width:1366,height:768});
    await page.getByRole('link',{name:'Y-Sheets',exact:true}).click();
    await page.getByRole('button',{name:'Recover',exact:true}).click();
    await page.locator('[data-save-status="conflict"]').waitFor();
    assert.equal(await formula.inputValue(),'=42');
    assert.deepEqual(errors,[]);
    await context.close();
  }
  // Signed-out access must display login; no workbook or fullscreen shell.
  const guest=await browser.newContext(); await guest.route('https://**/*',r=>r.abort());
  const page=await guest.newPage(); await page.goto(new URL('/y-sheets',base).href);
  await page.waitForSelector('input[type="password"]');
  assert.equal(await page.locator('[data-y-sheets-scroll], [data-layout="fullscreen"]').count(),0);
  await guest.close();
  console.log('PASS: 16 fullscreen geometry cases (four sizes × two languages × two themes), guarded Back/return, conflict recovery, standard shell restoration and guest denial. Screenshots:',out);
} finally { await browser.close(); }
