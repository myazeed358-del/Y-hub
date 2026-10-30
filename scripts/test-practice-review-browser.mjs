// Real Tutor UI/KaTeX with intercepted remote responses; not hosted provider proof.
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
  process.env.YHUB_SCREENSHOTS || "/workspace/practice-review-screenshots";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const id = "00000000-0000-4000-8000-000000000001",
  course = "00000000-0000-4000-8000-000000000002",
  source = "00000000-0000-4000-8000-000000000003",
  version = "00000000-0000-4000-8000-000000000004",
  sid = "00000000-0000-4000-8000-000000000005",
  rid = "00000000-0000-4000-8000-000000000006",
  student = "00000000-0000-4000-8000-000000000007";
const user = {
  id,
  email: "review@example.invalid",
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
      errors = [],
      writes = [];
    const ar = language === "ar";
    let allowed = true,
      state = role === "instructor" ? "requested" : "unverified",
      revision = role === "instructor" ? 3 : 1;
    const item = {
      id: source,
      revision: version,
      title: "Approved book",
      kind: "pdf",
      status: "ready",
      role: "primary",
      policyRevision: 1,
      pages: [2],
      material_id: id,
    };
    const evidence = {
      id: source,
      source_id: source,
      revision: version,
      title: "Approved book",
      page: 2,
      unit_id: null,
      text: "Power rule",
    };
    const question = {
      prompt: String.raw`مشتقة الدالة \[f(x)=x^2\]`,
      options: ["$x$", "$2x$", "$3x$", "$4x$"],
      choice: 1,
      suggestedChoice: 0,
      explanation: "Unverified original suggestion",
      citations: [evidence],
    };
    const outcome = ar ? "uncertain" : "unavailable";
    const detail = () => ({
      review: {
        id: rid,
        session_id: sid,
        position: 1,
        course_id: course,
        student_id: role === "student" ? id : student,
        state,
        auto_outcome: outcome,
        revision,
        resolved_by: state === "resolved" ? id : null,
      },
      question,
      automatic: {
        choice: null,
        explanation: ar ? "الفحص غير حاسم" : "Automatic recheck unavailable",
      },
      resolution:
        state === "resolved"
          ? {
              choice: 1,
              explanation: String.raw`قاعدة القوة: \[\frac{d}{dx}x^2=2x\]`,
              score: 1,
            }
          : null,
    });
    const assessment = () => ({
      earned: state === "resolved" ? 1 : 0,
      graded: state === "resolved" ? 1 : 0,
      pending: state === "resolved" ? 0 : 1,
      excluded: 0,
      items: [
        {
          position: 1,
          id: state === "unverified" ? null : rid,
          state,
          revision: state === "unverified" ? null : revision,
          outcome: ["unverified", "automatic_pending"].includes(state)
            ? null
            : outcome,
          score: state === "resolved" ? 1 : null,
        },
      ],
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
          full_name_ar: "مراجع",
          full_name_en: "Reviewer",
          user_number: "001234567",
          major: "mathematics",
        });
      if (url.pathname === "/rest/v1/courses")
        return json({ id: course, title: "Calculus" });
      if (url.pathname === "/rest/v1/rpc/ai_tutor_access")
        return json(
          !route.request().postDataJSON().p_manage || role === "instructor",
        );
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
      if (url.pathname === "/rest/v1/rpc/list_ai_practice_sessions")
        return json([
          {
            id: sid,
            mode: "practice",
            difficulty: "medium",
            language,
            target: 1,
            created_at: "2026-10-29T10:00:00Z",
            updated_at: "2026-10-29T10:00:00Z",
            submitted_at: null,
          },
        ]);
      if (url.pathname === "/rest/v1/rpc/read_ai_practice_session")
        return allowed
          ? json({
              id: sid,
              courseId: course,
              mode: "practice",
              difficulty: "medium",
              language,
              target: 1,
              revision: 3,
              submittedAt: null,
              questions: [
                {
                  position: 1,
                  prompt: question.prompt,
                  options: question.options,
                  choice: 1,
                  answered: true,
                  feedback: {
                    suggestedChoice: 0,
                    matchesSuggestion: false,
                    explanation: question.explanation,
                    citations: [evidence],
                  },
                },
              ],
            })
          : json({ code: "42501" }, 403);
      if (url.pathname === "/rest/v1/rpc/get_ai_practice_assessment")
        return allowed ? json(assessment()) : json({ code: "42501" }, 403);
      if (url.pathname === "/rest/v1/rpc/begin_ai_practice_review") {
        const args = route.request().postDataJSON();
        writes.push(args);
        assert.deepEqual(args, { p_session: sid, p_position: 1 });
        state = "automatic_pending";
        return json(rid);
      }
      if (url.pathname === "/functions/v1/ai-practice-recheck") {
        assert.deepEqual(route.request().postDataJSON(), { reviewId: rid });
        state = "needs_review";
        revision = 2;
        return json({ stored: true });
      }
      if (url.pathname === "/rest/v1/rpc/request_ai_practice_human_review") {
        const args = route.request().postDataJSON();
        writes.push(args);
        assert.deepEqual(args, { p_review: rid, p_revision: 2 });
        state = "requested";
        revision = 3;
        return json(3);
      }
      if (url.pathname === "/rest/v1/rpc/get_ai_practice_review")
        return allowed ? json(detail()) : json({ code: "42501" }, 403);
      if (url.pathname === "/rest/v1/rpc/list_ai_practice_reviews") {
        const args = route.request().postDataJSON();
        assert.equal(args.p_course, course);
        if (!allowed) return json({ code: "42501" }, 403);
        return json(
          (args.p_resolved ? state === "resolved" : state === "requested")
            ? [
                {
                  id: rid,
                  position: 1,
                  state,
                  revision,
                  created_at: "2026-10-29T10:00:00Z",
                  student_id: student,
                  full_name: "Student",
                  full_name_ar: "طالب عربي",
                  full_name_en: "Student Name",
                  user_number: "001234568",
                },
              ]
            : [],
        );
      }
      if (url.pathname === "/rest/v1/rpc/resolve_ai_practice_review") {
        const args = route.request().postDataJSON();
        writes.push(args);
        assert.equal(args.p_review, rid);
        assert.equal(args.p_revision, 3);
        assert.equal(args.p_choice, 1);
        state = "resolved";
        revision = 4;
        return json(4);
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
    page.on("dialog", (d) => d.accept());
    await page.goto(new URL(`/course/${course}/ai-tutor`, base).href);
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
        role,
        errors,
        body: await page.locator("body").innerText(),
      });
      throw error;
    }
    const click = (root, en, arabic) =>
      root.getByRole("button", { name: ar ? arabic : en, exact: true }).click();
    if (role === "student") {
      assert.equal(
        await page
          .getByRole("button", {
            name: ar ? "مراجعات إجابات الشعبة" : "Section answer reviews",
          })
          .count(),
        0,
      );
      await click(page, "Saved practice sessions", "جلسات التدريب المحفوظة");
      await page
        .getByRole("button")
        .filter({ hasText: ar ? "قيد التقدم" : "In progress" })
        .click();
      const panel = page.getByRole("region", {
        name: ar
          ? "مراجعة الإجابات والنتائج المحسومة"
          : "Answer review and confirmed results",
        exact: true,
      });
      await panel
        .getByText(ar ? "اقتراح غير متحقق منه" : "Unverified suggestion", {
          exact: false,
        })
        .waitFor();
      assert.equal(await panel.getByText("0/1", { exact: true }).count(), 0);
      await click(panel, "Recheck this answer", "إعادة فحص هذه الإجابة");
      await click(panel, "Request instructor review", "طلب مراجعة الدكتور");
      await click(panel, "Review details", "تفاصيل المراجعة");
      await panel.locator(".katex").first().waitFor();
      assert.equal(
        await panel
          .getByRole("button", {
            name: ar ? "اعتماد الحسم" : "Apply resolution",
          })
          .count(),
        0,
      );
      state = "resolved";
      revision = 4;
      await panel
        .getByRole("button", {
          name: ar ? "تحديث المراجعات" : "Refresh reviews",
          exact: true,
        })
        .first()
        .click();
      await panel.getByText("1/1", { exact: true }).waitFor();
      await page.screenshot({
        path: `${output}/${width}-${language}-${role}.png`,
        fullPage: true,
      });
      allowed = false;
      await panel
        .getByRole("button", {
          name: ar ? "تحديث المراجعات" : "Refresh reviews",
          exact: true,
        })
        .first()
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: ar ? "سُحب الوصول" : "Access withdrawn" })
        .waitFor();
      assert.equal(await page.getByLabel("1: 1", { exact: true }).count(), 0);
    } else {
      await click(page, "Section answer reviews", "مراجعات إجابات الشعبة");
      const studentButton = page
        .getByRole("button")
        .filter({ hasText: ar ? "طالب عربي" : "Student Name" });
      await studentButton.click();
      const select = page.getByLabel(
        ar ? "الخيار الصحيح بعد المراجعة" : "Correct option after review",
      );
      // Values are zero-based while visible labels are one-based. Match value
      // explicitly; a bare string can select the first matching label instead.
      await select.selectOption({ value: "1" });
      assert.equal(await select.inputValue(), "1");
      await page
        .getByLabel(
          ar
            ? "شرح القرار (١٠–٢٠٠٠ حرف)"
            : "Explain the resolution (10–2000 characters)",
        )
        .fill("Verified with the approved course reference.");
      await click(page, "Apply resolution", "اعتماد الحسم");
      await page
        .getByText(ar ? "الحسم البشري" : "Human resolution", { exact: true })
        .waitFor();
      assert.equal(await select.count(), 0);
      assert.equal(writes.at(-1).p_choice, 1);
      await page.screenshot({
        path: `${output}/${width}-${language}-${role}.png`,
        fullPage: true,
      });
      allowed = false;
      await page
        .getByRole("button", {
          name: ar ? "تحديث المراجعات" : "Refresh reviews",
          exact: true,
        })
        .first()
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: ar ? "لم يعد الوصول" : "Access no longer" })
        .waitFor();
      assert.equal(
        await page
          .getByText(ar ? "الحسم البشري" : "Human resolution", { exact: true })
          .count(),
        0,
      );
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}/${language}/${theme}/${role}: review progression, scoped controls, delayed scoring, LaTeX, revocation.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
