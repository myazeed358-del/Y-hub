// Real Tutor React/CSS/KaTeX, fixture network; not hosted Supabase/provider proof.
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
assert(["127.0.0.1", "localhost"].includes(base.hostname));
const output =
  process.env.YHUB_SCREENSHOTS || "/workspace/practice-session-screenshots";
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
  email: "practice@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const exp = Math.floor(Date.now() / 1000) + 3600,
  token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", exp })).toString("base64url")}.synthetic`;
try {
  for (const [width, language, theme, mode] of [
    [390, "ar", "dark", "practice"],
    [1280, "en", "light", "exam"],
    [390, "en", "light", "exam"],
    [1280, "ar", "dark", "practice"],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      errors = [],
      writes = [];
    let state = null,
      allowed = true,
      offline = false;
    const ar = language === "ar";
    const evidence = {
      id,
      source_id: source,
      revision,
      title: "Approved book",
      page: 2,
      unit_id: null,
      text: "Source passage",
    };
    const feedback = {
      suggestedChoice: 0,
      matchesSuggestion: true,
      explanation: String.raw`قاعدة القوة: \[\frac{d}{dx}x^2=2x\]`,
      citations: [evidence],
    };
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
          role: "student",
          full_name_ar: "طالب",
          full_name_en: "Student",
          user_number: "001234567",
          major: "mathematics",
        });
      if (url.pathname === "/rest/v1/courses")
        return json({ id: course, title: "Calculus" });
      if (url.pathname === "/rest/v1/rpc/ai_tutor_access")
        return json(!route.request().postDataJSON().p_manage);
      if (url.pathname === "/rest/v1/ai_tutor_sources") return json([item]);
      if (url.pathname === "/rest/v1/rpc/get_ai_practice_sources")
        return json({
          courseId: course,
          canManage: false,
          primaryId: source,
          limited: false,
          sources: [item],
          units: [],
        });
      if (url.pathname === "/rest/v1/rpc/list_ai_practice_sessions")
        return json(
          state
            ? [
                {
                  id: state.id,
                  mode: state.mode,
                  difficulty: "medium",
                  language,
                  target: 1,
                  created_at: "2026-10-29T10:00:00Z",
                  updated_at: "2026-10-29T10:00:00Z",
                  submitted_at: state.submittedAt,
                },
              ]
            : [],
        );
      if (url.pathname === "/rest/v1/rpc/create_ai_practice_session") {
        const args = route.request().postDataJSON();
        writes.push(args);
        state = {
          id: args.p_id,
          courseId: course,
          mode: args.p_mode,
          difficulty: args.p_difficulty,
          language: args.p_language,
          target: args.p_target,
          revision: 1,
          submittedAt: null,
          questions: [],
        };
        return json(state.id);
      }
      if (url.pathname === "/rest/v1/rpc/get_ai_practice_assessment") {
        const released = state.questions.filter(
          (q) =>
            q.choice !== null &&
            (state.submittedAt || (state.mode === "practice" && q.answered)),
        );
        return json({
          earned: 0,
          graded: 0,
          pending: released.length,
          excluded: 0,
          items: released.map((q) => ({
            position: q.position,
            id: null,
            state: "unverified",
            revision: null,
            outcome: null,
            score: null,
          })),
        });
      }
      if (url.pathname === "/rest/v1/rpc/read_ai_practice_session")
        return allowed ? json(state) : json({ code: "42501" }, 403);
      if (url.pathname === "/functions/v1/ai-practice-generate") {
        const args = route.request().postDataJSON();
        assert.deepEqual(args, { sessionId: state.id, position: 1 });
        state.questions = [
          {
            position: 1,
            prompt: String.raw`احسب المشتقة \[f(x)=x^2\]`,
            options: ["$2x$", "$3x$", "$4x$", "$5x$"],
            choice: null,
            answered: false,
            feedback: null,
          },
        ];
        state.revision++;
        return json({ stored: true });
      }
      if (url.pathname === "/rest/v1/rpc/save_ai_practice_answer") {
        const args = route.request().postDataJSON();
        writes.push(args);
        if (offline) return json({ code: "unavailable" }, 503);
        state.questions[0].choice = args.p_choice;
        state.questions[0].answered = args.p_answer;
        if (args.p_answer && mode === "practice")
          state.questions[0].feedback = feedback;
        return json(++state.revision);
      }
      if (url.pathname === "/rest/v1/rpc/submit_ai_practice_session") {
        state.submittedAt = "2026-10-29T12:00:00Z";
        state.questions[0].feedback = feedback;
        return json(++state.revision);
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
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("browser console:", msg.text());
    });
    page.on("requestfailed", (req) =>
      console.error(
        "failed request:",
        new URL(req.url()).pathname,
        req.failure()?.errorText,
      ),
    );
    page.on("dialog", (d) => d.accept());
    const open = async () => {
      try {
        await page
          .locator("summary")
          .filter({
            hasText: ar
              ? "مراجع التدريب ونطاقه"
              : "Practice references and scope",
          })
          .click();
      } catch (error) {
        console.error({
          width,
          language,
          mode,
          url: page.url(),
          errors,
          body: await page.locator("body").innerText(),
        });
        await page.screenshot({
          path: `${output}/failed-${width}-${language}.png`,
          fullPage: true,
        });
        throw error;
      }
      await page
        .getByRole("button", {
          name: ar ? "جلسات التدريب المحفوظة" : "Saved practice sessions",
          exact: true,
        })
        .click();
    };
    const click = async (en, arabic) =>
      page.getByRole("button", { name: ar ? arabic : en, exact: true }).click();
    await page.goto(new URL(`/course/${course}/ai-tutor`, base).href);
    await open();
    await click("Select primary book", "اختيار الكتاب الأساسي");
    await page
      .getByLabel(ar ? "وضع الجلسة" : "Session mode")
      .selectOption(mode);
    await page
      .getByLabel(ar ? "عدد الأسئلة (١–١٠٠)" : "Questions (1–100)")
      .fill("1");
    await click("Create session", "إنشاء جلسة");
    await click("Generate next question", "توليد السؤال التالي");
    await page.getByLabel("1: 1", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByText("Approved book — p. 2 / ص. 2", { exact: true })
        .count(),
      0,
    );
    offline = true;
    await page.getByLabel("1: 1", { exact: true }).check();
    await page
      .getByRole("alert")
      .filter({ hasText: ar ? "تعذر الاتصال" : "Connection or service" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).choice,
        `yhub-practice-choice:${id}:${state.id}`,
      ),
      0,
    );
    // Refresh keeps only local ordinal/choice metadata, then rechecks protected content.
    await page.reload();
    await open();
    await page
      .getByRole("button")
      .filter({ hasText: ar ? "قيد التقدم" : "In progress" })
      .click();
    await page
      .getByText(
        ar
          ? "يوجد اختيار مستعاد محليًا. راجع السؤال الحالي قبل الحفظ."
          : "Local recovery found. Review the current question before saving.",
        { exact: true },
      )
      .waitFor();
    offline = false;
    await click("Save answer draft", "حفظ مسودة الإجابة");
    await page
      .getByText(ar ? "محفوظ في حسابك" : "Saved to your account", {
        exact: true,
      })
      .waitFor();
    if (mode === "practice") await click("Confirm answer", "تأكيد الإجابة");
    else
      await click(
        "Submit self-test / finish practice",
        "تسليم الاختبار / إنهاء التدريب",
      );
    await page
      .getByText(
        ar ? "يطابق اقتراح الذكاء الاصطناعي" : "Matches the AI suggestion",
        { exact: true },
      )
      .waitFor();
    await page
      .getByText("Approved book — p. 2 / ص. 2", { exact: true })
      .waitFor();
    assert((await page.locator(".katex").count()) > 2);
    assert.equal(await page.locator(".katex-error").count(), 0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `${output}/${width}-${language}-${mode}.png`,
      fullPage: true,
    });
    allowed = false;
    await click("Reload current session", "إعادة تحميل الجلسة الحالية");
    await page
      .getByRole("alert")
      .filter({ hasText: ar ? "سُحب الوصول" : "Access withdrawn" })
      .waitFor();
    assert.equal(await page.getByLabel("1: 1", { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}/${language}/${theme}/${mode}: scope, generation, lost connection/reload recovery, delayed feedback, KaTeX, revocation.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
