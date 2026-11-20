import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { sheetsFixture } from './y-sheets-browser-fixture.mjs';
const { chromium } = await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost', '127.0.0.1'].includes(base.hostname));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  for (const width of [390,1280]) for (const language of ['ar','en']) {
    const { context, state } = await sheetsFixture(browser, base, { width, language, theme: language === 'ar' ? 'dark' : 'light' });
    let unavailable = false;
    await context.route('**/rest/v1/rpc/save_y_sheets_workbook', route => unavailable
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic offline transport' }) })
      : route.fallback());
    const file = [...state.rows.values()][0];
    file.content = { id: file.id, name: file.name, version: 1, activeSheetId: 's', sheets: [{ id:'s', name:'Sheet1', rowCount:20, colCount:10, cells:{}, columnWidths:{}, rowHeights:{}, mergedCells:[], conditionalFormats:[], validations:{} }] };
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/y-sheets',base).href);
    await page.getByRole('article', { name: file.name, exact: true }).locator('.ys-file-open').click();
    const formula = page.getByPlaceholder(/Enter a value or formula/);
    await formula.waitFor();
    unavailable = true;
    await formula.fill('=20+22'); await formula.press('Enter');
    await page.locator('[data-save-status="error"]').waitFor();
    assert.equal(state.rows.get(file.id).revision,1);
    unavailable = false;
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('online')); });
    await page.locator('[data-save-status="saved"]').waitFor();
    assert.equal(state.rows.get(file.id).revision,2); assert.equal(state.receipts.size,1);
    assert.equal(state.rows.get(file.id).content.sheets[0].cells['0,0'].computed,42);
    // The next failed edit must retain the last acknowledged value as its base.
    unavailable = true;
    await formula.fill('=99'); await formula.press('Enter');
    await page.locator('[data-save-status="error"]').waitFor();
    const records = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('y-sheets-recovery:')).map(k => JSON.parse(localStorage.getItem(k))));
    assert(records.some(r => r.base?.sheets[0].cells['0,0'].raw === '=20+22' && r.workbook.sheets[0].cells['0,0'].raw === '=99'));
    const remote = state.rows.get(file.id); remote.revision++; remote.content.sheets[0].cells['0,0'] = { raw: 'other device', computed: 'other device' };
    unavailable = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.locator('[data-save-status="conflict"]').waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    assert.equal(state.rows.get(file.id).content.sheets[0].cells['0,0'].raw,'other device');
    assert.equal(state.receipts.size,1); assert.deepEqual(errors,[]);
    console.log(`PASS ${width}/${language}: reconnect retry, duplicate-event suppression, confirmed base, remote conflict retained.`);
    await context.close();
  }
} finally { await browser.close(); }
