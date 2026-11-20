import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sheetsFixture } from './y-sheets-browser-fixture.mjs';
const { chromium } = await import(pathToFileURL('/workspace/.yhub-browser/node_modules/playwright-core/index.mjs').href);
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost', '127.0.0.1'].includes(base.hostname));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
await mkdir('/workspace/sheets-recovery-merge-screenshots', { recursive: true });
try {
  for (const width of [390, 1280]) for (const language of ['ar', 'en']) {
    const theme = language === 'ar' ? 'dark' : 'light';
    const { context, state } = await sheetsFixture(browser, base, { width, language, theme });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(30000);
    const file = [...state.rows.values()][0];
    const original = { id: file.id, name: 'Recovery example', version: 1, activeSheetId: 's', sheets: [{ id: 's', name: 'Sheet1', rowCount: 20, colCount: 10, cells: {}, columnWidths: {}, rowHeights: {}, mergedCells: [], conditionalFormats: [], validations: {} }] };
    file.name = original.name; file.content = structuredClone(original); file.content.sheets[0].cells['0,1'] = { raw: 'remote' }; file.revision = 2;
    const local = structuredClone(original); local.sheets[0].cells['0,0'] = { raw: 'local' };
    const owner = '00000000-0000-4000-8000-000000000001';
    const key = `y-sheets-recovery:v1:${owner}:browser:${file.id}`;
    const record = { version: 1, ownerId: owner, workbook: local, base: original, checkpoint: { revision: 1 }, updatedAt: new Date().toISOString() };
    await context.addInitScript(({ key, record }) => { if (!sessionStorage.getItem('seeded-merge')) { localStorage.setItem(key, JSON.stringify(record)); sessionStorage.setItem('seeded-merge', 'yes'); } }, { key, record });
    await page.goto(new URL('/y-sheets', base).href);
    const panel = page.getByRole('region', { name: 'Local recovery', exact: true });
    const merge = () => panel.getByRole('button', { name: language === 'ar' ? 'دمج مع أحدث نسخة' : 'Merge with latest', exact: true });
    await merge().waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await panel.screenshot({ path: `/workspace/sheets-recovery-merge-screenshots/${width}-${language}.png` });
    // Overlap must preserve recovery and never dispatch a save.
    file.content.sheets[0].cells['0,0'] = { raw: 'competing' };
    await merge().click();
    await page.getByRole('alert').filter({ hasText: 'overlap' }).waitFor();
    assert.equal(file.revision, 2); assert(await page.evaluate(key => localStorage.getItem(key) !== null, key));
    delete file.content.sheets[0].cells['0,0'];
    await merge().click();
    await page.getByPlaceholder(/Enter a value or formula/).waitFor();
    await new Promise((resolve, reject) => { const start = Date.now(); const check = () => { if (state.rows.get(file.id).revision === 3) return resolve(); if (Date.now() - start > 15000) return reject(Error('Save not acknowledged')); setTimeout(check, 100); }; check(); });
    assert.equal(state.rows.get(file.id).content.sheets[0].cells['0,0'].raw, 'local');
    assert.equal(state.rows.get(file.id).content.sheets[0].cells['0,1'].raw, 'remote');
    await page.waitForFunction(key => localStorage.getItem(key) === null, key);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}/${theme}/${language}: overlap retained, explicit merge saved both edits at current revision, recovery acknowledged.`);
    await context.close();
  }
} finally { await browser.close(); }
