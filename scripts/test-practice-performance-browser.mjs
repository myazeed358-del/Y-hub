// Actual Tutor route/React/CSS. HTTP fixtures; not hosted Supabase/provider proof.
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
const output =
  process.env.YHUB_SCREENSHOTS || "/workspace/practice-performance-screenshots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const id = "00000000-0000-4000-8000-000000000001",
  course = "00000000-0000-4000-8000-000000000002",
  source = "00000000-0000-4000-8000-000000000003",
  revision = "00000000-0000-4000-8000-000000000004";
const user = {
  id,
  email: "performance@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600,
  token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", exp })).toString("base64url")}.synthetic`;
try {
  for (const [width, language, theme, role] of [
    [390, "ar", "dark", "student"],
    [1280, "en", "light", "student"],
    [390, "ar", "light", "instructor"],
    [1280, "en", "dark", "instructor"],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      writes = [],
      errors = [],
      reads = [];
    let allowed = true,
      conflict = true,
      weights = { practice: 40, exam: 60, revision: 1 };
    const ar = language === "ar";
    const item = {
      id: source,
      revision,
      title: "Approved book",
      kind: "pdf",
      status: "ready",
      role: "primary",
      policyRevision: 1,
      pages: [2],
      material_id: id,
    };
    const summary = () => ({
      score: weights.practice,
      coverage: 100,
      practice: { earned: 1, graded: 1, pending: 2, excluded: 1, percent: 100 },
      exam: { earned: 0, graded: 1, pending: 0, excluded: 0, percent: 0 },
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === base.origin) return route.continue();
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.pathname === "/auth/v1/user") return json(user);
      if (url.pathname === "/rest/v1/users")
        return json({
          ...user,
          role,
          full_name_ar: "طالب تجريبي",
          full_name_en: "Local Test",
          user_number: "001234567",
          major: "mathematics",
        });
      if (url.pathname === "/rest/v1/rpc/ai_tutor_access")
        return json(
          !route.request().postDataJSON().p_manage || role === "instructor",
        );
      if (url.pathname === "/rest/v1/courses")
        return json({ id: course, title: "Calculus" });
      if (url.pathname === "/rest/v1/ai_tutor_sources") return json([item]);
      if (url.pathname === "/rest/v1/rpc/get_ai_practice_sources")
        return json({
          courseId: course,
          canManage: role === "instructor",
          primaryId: source,
          limited: false,
          sources: [item],
          units: [],
        });
      if (url.pathname === "/rest/v1/rpc/read_ai_practice_performance") {
        const args = route.request().postDataJSON();
        reads.push(args);
        assert.deepEqual(Object.keys(args).sort(), ["p_course", "p_offset"]);
        assert.equal(args.p_course, course);
        if (!allowed) return json({ code: "42501" }, 403);
        return json({
          courseId: course,
          canManage: role === "instructor",
          weights,
          summary: summary(),
          units: [
            {
              unitId: source,
              title: args.p_offset === 0 ? "Calculus unit" : "Algebra unit",
              summary: summary(),
            },
          ],
          unitCount: 21,
          offset: args.p_offset,
          hasMore: args.p_offset === 0,
          unavailableSessions: 1,
        });
      }
      if (url.pathname === "/rest/v1/rpc/set_ai_practice_performance_weights") {
        assert.equal(role, "instructor");
        const args = route.request().postDataJSON();
        writes.push(args);
        if (conflict) {
          conflict = false;
          weights = { practice: 70, exam: 30, revision: 2 };
          return json({ code: "PT409" }, 409);
        }
        assert.equal(args.p_revision, weights.revision);
        weights = {
          practice: args.p_practice,
          exam: args.p_exam,
          revision: weights.revision + 1,
        };
        return json(weights.revision);
      }
      if (url.pathname.startsWith("/rest/v1/")) return json([]);
      return route.abort();
    });
    await context.addInitScript(
      ({ user, token, exp, language, theme }) => {
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
        localStorage.setItem("yhub-language", language);
        localStorage.setItem("theme", theme);
      },
      { user, token, exp, language, theme },
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL(`/course/${course}/ai-tutor`, base).href);
    await page
      .locator("summary")
      .filter({
        hasText: ar ? "مراجع التدريب ونطاقه" : "Practice references and scope",
      })
      .click();
    const title = ar
      ? "أدائي التدريبي في المساق"
      : "My course practice performance";
    assert.equal(reads.length, 0);
    await page.getByRole("button", { name: title, exact: true }).click();
    const panel = page.locator(`div[aria-label="${title}"]`);
    await panel.getByText("Calculus unit", { exact: true }).waitFor();
    assert.equal(
      await panel.locator("..").getAttribute("dir"),
      ar ? "rtl" : "ltr",
    );
    await panel
      .getByText(
        ar
          ? "لا يشمل امتحانات المساق الرسمية."
          : "This does not include official course exams.",
        { exact: false },
      )
      .waitFor();
    await panel
      .getByRole("button", {
        name: ar ? "الوحدات التالية" : "Next units",
        exact: true,
      })
      .click();
    await panel.getByText("Algebra unit", { exact: true }).waitFor();
    assert.equal(reads.at(-1).p_offset, 20);
    const click = async (en, arabic) =>
      panel
        .getByRole("button", { name: ar ? arabic : en, exact: true })
        .click();
    if (role === "instructor") {
      const practice = panel.getByLabel(ar ? "التدريب (%)" : "Practice (%)", {
          exact: true,
        }),
        exam = panel.getByLabel(
          ar ? "الاختبارات الذاتية المسلّمة (%)" : "Submitted self-tests (%)",
          { exact: true },
        );
      await practice.fill("60");
      await exam.fill("40");
      await click("Save course weights", "حفظ أوزان المساق");
      await panel.getByRole("alert").waitFor();
      assert.equal(writes[0].p_revision, 1);
      await click("Refresh performance", "تحديث الأداء");
      await panel
        .getByText(
          ar
            ? "تغيرت أوزان المساق من جهاز آخر. حمّلها قبل استبدالها."
            : "Course weights changed on another device. Reload them before replacing them.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await practice.inputValue(), "60");
      await click("Use current weights", "استخدام الأوزان الحالية");
      assert.equal(await practice.inputValue(), "70");
      await practice.fill("60");
      await exam.fill("40");
      await click("Save course weights", "حفظ أوزان المساق");
      await panel.getByText("Algebra unit", { exact: true }).waitFor();
      assert.equal(writes.at(-1).p_revision, 2);
      assert.equal(weights.practice, 60);
    } else
      assert.equal(
        await panel
          .getByRole("button", {
            name: ar ? "حفظ أوزان المساق" : "Save course weights",
            exact: true,
          })
          .count(),
        0,
      );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `${output}/${width}-${language}-${role}.png`,
      fullPage: true,
    });
    allowed = false;
    await click("Refresh performance", "تحديث الأداء");
    await panel.getByRole("alert").waitFor();
    assert.equal(
      await panel.getByText("Algebra unit", { exact: true }).count(),
      0,
    );
    assert.equal(
      await panel
        .getByRole("button", {
          name: ar ? "حفظ أوزان المساق" : "Save course weights",
          exact: true,
        })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}/${language}/${theme}/${role}: weighted indicator, pending counts, own results, server pages, draft/CAS conflict, revocation and responsive layout.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
