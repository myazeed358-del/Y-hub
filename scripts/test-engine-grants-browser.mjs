// Actual route and CSS with isolated HTTP fixtures; no production traffic.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  pathToFileURL(
    process.env.YHUB_PLAYWRIGHT_MODULE ||
      "/workspace/.yhub-browser/node_modules/playwright-core/index.mjs",
  ).href
);
const base = new URL(
  process.env.YHUB_BROWSER_BASE_URL || "http://127.0.0.1:5175",
);
assert(["localhost", "127.0.0.1"].includes(base.hostname));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const output = process.env.YHUB_SCREENSHOTS || "/workspace/grant-screenshots";
await mkdir(output, { recursive: true });
const id = "00000000-0000-4000-8000-000000000001",
  studentId = "00000000-0000-4000-8000-000000000002",
  course = "00000000-0000-4000-8000-000000000003";
const user = {
  id,
  email: "grant@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600,
  token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${
    Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", exp }))
      .toString("base64url")
  }.synthetic`;
try {
  for (
    const [width, language, theme, role] of [
      [390, "ar", "dark", "instructor"],
      [1280, "en", "light", "instructor"],
      [1280, "en", "dark", "admin"],
    ]
  ) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const ar = language === "ar", calls = [];
    let grants = [];
    const student = {
      student_id: studentId,
      course_id: course,
      full_name: "طالب الاختبار / Student",
      user_number: "001234567",
      title: "Section / شعبة",
      section_label: "01",
      active_enrollment: true,
    };
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.origin === base.origin) return route.continue();
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      const payload = route.request().postDataJSON();
      calls.push({ path: u.pathname, payload });
      if (u.pathname === "/auth/v1/user") return json(user);
      if (u.pathname === "/rest/v1/users") {
        return json({
          ...user,
          role,
          full_name: "Grant fixture",
          major: "mathematics",
        });
      }
      if (u.pathname === "/rest/v1/courses") {
        return json([{
          id: course,
          title: student.title,
          section_label: "01",
          instructor_id: id,
        }]);
      }
      if (u.pathname === "/rest/v1/rpc/delegable_engines") {
        return json([{ module_id: "linear-algebra" }, { module_id: "ode" }]);
      }
      if (u.pathname === "/rest/v1/rpc/search_engine_students") {
        return json({ rows: [student], total: 1 });
      }
      if (u.pathname === "/rest/v1/rpc/engine_grant_history") {
        const rows = grants.filter((g) =>
          (g.state === "active") === payload.p_active
        );
        return json({ rows, total: rows.length });
      }
      if (u.pathname === "/rest/v1/rpc/grant_engine_access_batch") {
        grants = payload.p_engines.map((engine, i) => ({
          ...student,
          id: `00000000-0000-4000-8000-00000000001${i}`,
          engine_id: engine,
          expires_at: payload.p_expires,
          revoked_at: null,
          revocation_reason: null,
          created_at: new Date().toISOString(),
          state: "active",
        }));
        return json(grants.map((g) => g.id));
      }
      if (u.pathname === "/rest/v1/rpc/revoke_engine_access") {
        grants = grants.map((g) =>
          g.id === payload.p_grant
            ? {
              ...g,
              state: "manual",
              revoked_at: new Date().toISOString(),
              revocation_reason: "manual",
            }
            : g
        );
        return json(payload.p_grant);
      }
      if (u.pathname.startsWith("/rest/v1/")) return json([]);
      return route.abort();
    });
    await context.addInitScript(({ user, token, exp, theme, language }) => {
      localStorage.setItem(
        "sb-rspdfdrmswixcmpozgzr-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "synthetic",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
      localStorage.setItem("theme", theme);
      localStorage.setItem("yhub-language", language);
    }, { user, token, exp, theme, language });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(new URL("/engine-access", base).href);
    await page.getByRole("heading", {
      name: ar
        ? "صلاحيات المحركات الاستثنائية"
        : "Exceptional engine permissions",
      exact: true,
    }).waitFor();
    await page.getByLabel(
      ar ? "اسم الطالب أو رقمه الجامعي" : "Student name or number",
      { exact: true },
    ).fill("001234567");
    await page.getByRole("button", { name: ar ? "بحث" : "Search", exact: true })
      .click();
    await page.getByRole("button", { name: /001234567/ }).click();
    const searchBox=await page.getByLabel(ar?'اسم الطالب أو رقمه الجامعي':'Student name or number',{exact:true}).boundingBox();
    if(width===390)assert(searchBox.width>=250,'Mobile search input must remain readable');
    await page.getByRole("heading", {
      name: ar ? "ملف الطالب" : "Student profile",
      exact: true,
    }).waitFor();
    assert(
      calls.some((c) =>
        c.path === "/rest/v1/rpc/search_engine_students" &&
        c.payload.p_course === null && c.payload.p_search === "001234567"
      ),
    );
    if (role === "instructor") {
      await page.getByRole("checkbox", {
        name: ar ? "الجبر الخطي" : "Linear Algebra",
        exact: true,
      }).check();
      await page.getByRole("checkbox", {
        name: ar ? "المعادلات التفاضلية" : "Differential Equations",
        exact: true,
      }).check();
      await page.getByRole("button", {
        name: ar ? "منح المحركات المختارة" : "Grant selected engines",
        exact: true,
      }).click();
      await page.getByRole("button", {
        name: ar ? "إلغاء المنحة" : "Revoke grant",
        exact: true,
      }).first().waitFor();
      assert.deepEqual(
        calls.find((c) => c.path === "/rest/v1/rpc/grant_engine_access_batch")
          .payload,
        {
          p_course: course,
          p_student: studentId,
          p_engines: ["linear-algebra", "ode"],
          p_expires: null,
        },
      );
      await page.getByRole("button", {
        name: ar ? "إلغاء المنحة" : "Revoke grant",
        exact: true,
      }).first().click();
      await page.getByRole("tab", {
        name: ar ? "سابق" : "Previous",
        exact: true,
      }).click();
      await page.getByText(ar ? "أُلغيت يدويًا" : "Manually revoked", {
        exact: true,
      }).waitFor();
    } else {assert.equal(
        await page.getByRole("button", {
          name: "Grant selected engines",
          exact: true,
        }).count(),
        0,
      );}
    assert(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth + 1
      ),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `output-placeholder/${width}-${language}-${role}.png`.replace(
        "output-placeholder",
        output,
      ),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}/${language}/${role}: scoped search, student number/profile, role-aware grants, active/history tabs and responsive layout.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
