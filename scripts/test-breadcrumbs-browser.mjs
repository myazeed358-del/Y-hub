// Real routed React/header and CSS. Synthetic Auth/HTTP; no external traffic.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.YHUB_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href : 'playwright-core');
const base = new URL(process.env.YHUB_BROWSER_BASE_URL || 'http://127.0.0.1:5175');
assert(['localhost', '127.0.0.1'].includes(base.hostname));
const output = process.env.YHUB_SCREENSHOTS || '/workspace/breadcrumb-screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const id = '00000000-0000-4000-8000-000000000001';
const course = '00000000-0000-4000-8000-000000000002';
const user = { id, email: 'breadcrumb@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', exp })).toString('base64url')}.synthetic`;
try {
  for (const [width, language, theme, role] of [
    [390, 'ar', 'dark', 'student'], [1280, 'en', 'light', 'student'],
    [390, 'en', 'light', 'instructor'], [1280, 'ar', 'dark', 'instructor'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin === base.origin) return route.continue();
      const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (u.pathname === '/auth/v1/user') return json(user);
      if (u.pathname === '/rest/v1/users') return json({ ...user, role, full_name: 'Breadcrumb fixture', major: 'mathematics' });
      if (u.pathname === '/rest/v1/rpc/ai_tutor_access') return json(true);
      if (u.pathname === '/rest/v1/courses') return json({ id: course, title: 'Calculus', instructor_id: id, is_published: true });
      if (u.pathname.startsWith('/rest/v1/')) return json([]);
      return route.abort();
    });
    await context.addInitScript(({ user, token, exp, language, theme }) => {
      localStorage.setItem('sb-rspdfdrmswixcmpozgzr-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }));
      localStorage.setItem('yhub-language', language);
      localStorage.setItem('theme', theme);
    }, { user, token, exp, language, theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL(`/course/${course}/ai-tutor`, base).href);
    const nav = page.getByRole('navigation', { name: language === 'ar' ? 'مسار التنقل' : 'Breadcrumb', exact: true });
    await nav.waitFor();
    assert.equal(await nav.getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
    const title = page.getByTestId('header-page-title');
    assert.equal(await title.textContent(), language === 'ar' ? 'المعلم الذكي' : 'AI Tutor');
    assert(await title.isVisible());
    const parent = nav.locator(`a[href="/course/${course}${role === 'student' ? '/view' : ''}"]`);
    assert(await parent.isVisible());
    assert.equal(await nav.locator('a[href="/dashboard"]').isVisible(), width >= 640);
    assert(!await nav.textContent().then(text => text.includes(course)));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const box = await nav.boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= width);
    await page.screenshot({ path: `${output}/${width}-${language}-${role}.png` });
    await parent.click();
    assert.equal(new URL(page.url()).pathname, `/course/${course}${role === 'student' ? '/view' : ''}`);
    await nav.waitFor();
    await nav.locator('a[href="/dashboard"]').click();
    await page.waitForURL('**/dashboard');
    assert.equal(await page.getByRole('navigation', { name: /Breadcrumb|مسار التنقل/, exact: true }).count(), 0);
    assert(await title.isVisible());
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}/${language}/${role}: root hidden, nested context, compact ancestors, retained title, parent navigation, no overflow.`);
    await context.close();
  }
} finally { await browser.close(); }
