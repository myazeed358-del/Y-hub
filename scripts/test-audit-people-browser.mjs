// Real React, route guards and CSS; HTTP fixtures are NOT live Supabase evidence.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.YHUB_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href : 'playwright-core');
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost', '127.0.0.1'].includes(base.hostname));
const output = process.env.YHUB_SCREENSHOTS || '/workspace/audit-people-screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const id = '00000000-0000-4000-8000-000000000001', affectedId = '00000000-0000-4000-8000-000000000002';
const user = { id, email: 'audit@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', exp })).toString('base64url')}.synthetic`;
const actor = { person_id: id, relation: 'actor', full_name: 'Instructor', full_name_ar: 'دكتور تجريبي', full_name_en: 'Test Instructor', user_number: '001234567', recorded: true };
const affected = { ...actor, person_id: affectedId, relation: 'affected', full_name: 'Student', full_name_ar: 'طالب تجريبي', full_name_en: 'Test Student', user_number: '009876543' };
const event = { id: '11111111-1111-4111-8111-111111111111', occurred_at: '2026-10-27T10:00:00Z', actor_id: id, actor_name: 'Instructor', actor_role: 'instructor', operation: 'UPDATE', actions: ['updated'], entity_type: 'courses', entity_id: '33333333-3333-4333-8333-333333333333', sensitivity: 'normal', super_admin_only: false, old_values: { is_published: true }, new_values: { is_published: false }, context: { changed_fields: ['is_published'] }, people: [actor, affected] };
try {
  for (const [width, language, theme, role] of [[390, 'ar', 'dark', 'admin'], [1280, 'en', 'light', 'super_admin']]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const requests = [], suggestions = [], errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base.origin) return route.continue();
      const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/auth/v1/user') return json(user);
      if (url.pathname === '/rest/v1/users') return json({ ...user, role, full_name: 'Reviewer', full_name_ar: 'مراجع تجريبي', full_name_en: 'Test Reviewer', user_number: '007654321', major: 'mathematics' });
      if (url.pathname === '/rest/v1/rpc/search_audit_events_v2') {
        const params = route.request().postDataJSON(); requests.push(params);
        return json({ events: [event], total: 123 });
      }
      if (url.pathname === '/rest/v1/rpc/suggest_audit_people') { suggestions.push(route.request().postDataJSON()); return json([affected]); }
      if (url.pathname.startsWith('/rest/v1/')) return json([]);
      return route.abort();
    });
    await context.addInitScript(({ user, token, exp, theme, language }) => {
      localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
      localStorage.setItem('yhub-language', language); localStorage.setItem('theme', theme);
    }, { user, token, exp, theme, language });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/audit-log', base).href);
    const ar = language === 'ar';
    const title = page.getByRole('heading', { name: ar ? 'سجل التدقيق' : 'Audit log', exact: true });
    await title.waitFor();
    await page.getByText(ar ? 'دكتور تجريبي' : 'Test Instructor', { exact: true }).waitFor();
    assert.equal(await title.locator('xpath=ancestor::section').getAttribute('dir'), ar ? 'rtl' : 'ltr');
    await page.getByText(ar ? 'النتائج: 123' : 'Results: 123', { exact: true }).waitFor();
    await page.getByLabel(ar ? 'البحث عن الشخص بصفته' : 'Search people as').selectOption('affected');
    await page.getByLabel(ar ? 'اسم الشخص أو رقمه ذو التسعة أرقام' : 'Person name or nine-digit number').fill('009876543');
    const choice = page.getByRole('button', { name: /009876543/ }); await choice.click();
    assert.equal(suggestions.at(-1).p_scope, 'affected');
    await page.getByRole('button', { name: ar ? 'تطبيق الفلاتر' : 'Apply filters', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.equal(requests.at(-1).p_actor, affectedId); assert.equal(requests.at(-1).p_person_scope, 'affected'); assert.equal(requests.at(-1).p_limit, 26);
    assert.equal(await page.getByText('009876543', { exact: true }).getAttribute('dir'), 'ltr');
    await page.getByRole('button', { name: ar ? 'التفاصيل' : 'Details', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByText(ar ? 'طالب تجريبي' : 'Test Student', { exact: true }).waitFor();
    await dialog.getByText('009876543', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/${width}-${language}-${role}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS audit people ${width}/${language}/${theme}/${role}: scoped selection, server count, details, LTR numbers and responsive viewport.`);
    await context.close();
  }
} finally { await browser.close(); }
