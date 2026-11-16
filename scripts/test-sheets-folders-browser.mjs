// Real workspace and CSS, fully intercepted HTTP. Local SQL/Auth tested separately.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { sheetsFixture } from './y-sheets-browser-fixture.mjs';
const { chromium } = await import(pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE || '/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost','127.0.0.1'].includes(base.hostname));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
await mkdir('/workspace/sheets-folders-screenshots',{recursive:true});
try {
 for (const width of [390,1280]) for (const theme of ['light','dark']) {
  const language=theme==='dark'?'ar':'en', t=(en,ar)=>language==='ar'?ar:en;
  const {context,state}=await sheetsFixture(browser,base,{width,theme,language});
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/y-sheets',base).href);
  await page.getByRole('article',{name:'Archive 00',exact:true}).waitFor();
  const create=async name=>{
   await page.getByRole('button',{name:t('New folder','مجلد جديد'),exact:true}).click();
   await page.getByLabel(t('Folder name','اسم المجلد'),{exact:true}).fill(name);
   await page.getByRole('button',{name:t('Save folder','حفظ المجلد'),exact:true}).click();
  };
  state.loseOrganizationAck=true;await create('Courses');
  await page.getByRole('alert').filter({hasText:t('Directory unavailable','تعذر الوصول')}).waitFor();
  assert.equal(state.folders.size,1);
  await page.getByRole('button',{name:t('Save folder','حفظ المجلد'),exact:true}).click();
  await page.getByRole('article',{name:'Courses',exact:true}).waitFor();assert.equal(state.folders.size,1);
  const folder=[...state.folders.values()][0],file=[...state.rows.values()][0],original=JSON.stringify(file);
  const row=()=>page.getByRole('article',{name:'Archive 00',exact:true});
  await row().getByRole('button',{name:t('Move','نقل'),exact:true}).click();
  await page.getByRole('article',{name:'Courses',exact:true}).locator('.ys-file-open').click();
  await page.getByRole('button',{name:t('Move here','نقل إلى هنا'),exact:true}).click();
  await row().waitFor();assert.equal(state.locations.get(file.id).parent_id,folder.id);assert.equal(JSON.stringify(file),original);
  await row().getByRole('button',{name:t('Favorite','مفضلة'),exact:true}).click();
  await row().getByRole('button',{name:t('Favorite','مفضلة'),exact:true}).and(page.locator('[aria-pressed="true"]')).waitFor();
  await row().getByRole('button',{name:t('Pin','تثبيت'),exact:true}).click();
  await row().getByRole('button',{name:t('Pin','تثبيت'),exact:true}).and(page.locator('[aria-pressed="true"]')).waitFor();
  await create('Nested');await page.getByRole('article',{name:'Nested',exact:true}).waitFor();
  await page.getByRole('article',{name:'Nested',exact:true}).locator('.ys-file-open').click();
  await page.getByRole('navigation',{name:t('Folder path','مسار المجلد')}).getByRole('button',{name:/Nested/}).waitFor();
  await page.getByRole('searchbox').fill('Archive 00');await page.getByRole('button',{name:t('Search','بحث'),exact:true}).click();await row().waitFor();
  assert.equal(await page.getByRole('article').count(),1);
  await page.getByLabel(t('Directory filter','تصفية الملفات')).selectOption('favorite');await row().waitFor();
  await page.getByRole('button',{name:'All files list',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/workspace/sheets-folders-screenshots/${width}-${language}-${theme}.png`});
  await page.reload();await page.getByRole('article',{name:'Courses',exact:true}).waitFor();
  await page.getByLabel(t('Directory filter','تصفية الملفات')).selectOption('pinned');await row().waitFor();
  assert.equal(await page.getByRole('article').count(),1);
  state.denied=true;await page.getByRole('button',{name:t('Refresh files','تحديث الملفات'),exact:true}).click();await page.getByRole('alert').filter({hasText:t('Directory unavailable','تعذر الوصول')}).waitFor();assert.equal(await page.getByRole('article').count(),0);
  assert.deepEqual(errors,[]);console.log(`PASS ${width}/${theme}/${language}: creation lost-ack, folder navigation, move, flags, global search, reload, access denial, overflow.`);
  await context.close();
 }
} finally { await browser.close(); }
