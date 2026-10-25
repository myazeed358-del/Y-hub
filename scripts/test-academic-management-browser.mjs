// Actual routed UI, synthetic HTTP fixtures; all external traffic is intercepted.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.YHUB_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.YHUB_PLAYWRIGHT_MODULE).href
    : "playwright-core"
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
const id = "00000000-0000-4000-8000-000000000001",
  teacher = "00000000-0000-4000-8000-000000000002",
  def = "00000000-0000-4000-8000-000000000003",
  section = "00000000-0000-4000-8000-000000000004";
const user = {
  id,
  email: "academic@example.invalid",
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
const output = process.env.YHUB_SCREENSHOTS ||
  "/workspace/academic-screenshots";
await mkdir(output, { recursive: true });
try {
  for (
    const [width, language, theme, role] of [[390, "ar", "dark", "admin"], [
      1280,
      "en",
      "light",
      "instructor",
    ], [1280, "en", "light", "student"]]
  ) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      calls = [];
    let definitions = [{
      id: def,
      title: "Calculus",
      code: "M1",
      description: null,
      department: "Science",
      academic_major: "mathematics",
      legacy_course_id: null,
      created_at: new Date().toISOString(),
    }];
    let sections = [{
      id: section,
      course_definition_id: def,
      instructor_id: role === "instructor" ? id : teacher,
      section_label: "01",
      academic_term: "Fall",
      title: "Calculus",
      course_code: "M1",
      description: null,
      is_published: true,
      enrollment_open: true,
      syllabus_source: "manual",
      created_at: new Date().toISOString(),
    }];
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.origin === base.origin) return route.continue();
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      calls.push({
        path: u.pathname,
        query: u.search,
        data: route.request().postDataJSON(),
      });
      if (u.pathname === "/auth/v1/user") return json(user);
      if (u.pathname === "/rest/v1/users") {
        return json({
          ...user,
          role,
          full_name: "Academic fixture",
          major: "mathematics",
        });
      }
      if (u.pathname === "/rest/v1/course_definitions") {
        return json(definitions);
      }
      if (u.pathname === "/rest/v1/course_sections") return json(sections);
      if (u.pathname === "/rest/v1/rpc/list_assignable_instructors") {
        return json([{
          id: teacher,
          full_name: "الدكتور التجريبي / Instructor",
        }]);
      }
      if (u.pathname === "/rest/v1/rpc/create_course_definition") {
        const p = route.request().postDataJSON();
        definitions.push({
          id: p.p_id,
          title: p.p_title,
          code: p.p_code,
          academic_major: p.p_major,
        });
        return json(p.p_id);
      }
      if (u.pathname === "/rest/v1/rpc/create_academic_section") {
        const p = route.request().postDataJSON();
        sections.push({
          ...sections[0],
          id: p.p_id,
          course_definition_id: p.p_definition,
          instructor_id: p.p_instructor,
          section_label: p.p_label,
          academic_term: p.p_term,
        });
        return json(p.p_id);
      }
      if (u.pathname === "/rest/v1/rpc/list_managed_course_enrollment_counts") {
        return json(
          sections.map((s) => ({ course_id: s.id, enrollment_count: 1 })),
        );
      }
      if (
        u.pathname === "/rest/v1/rpc/get_managed_course_enrollment_roster_v2"
      ) {
        return json([{
          student_id: id,
          full_name: "طالب تجريبي",
          user_number: "202600001",
          enrolled_at: new Date().toISOString(),
        }]);
      }
      if (
        [
          "/rest/v1/rpc/my_attendance_sections",
          "/rest/v1/rpc/my_online_lecture_sections",
        ].includes(u.pathname)
      ) {
        return json(
          sections.map((s) => ({
            id: s.id,
            title: s.title,
            section_label: s.section_label,
          })),
        );
      }
      if (u.pathname === "/rest/v1/rpc/attendance_report") {
        return json({
          rows: [],
          total: 0,
          stats: { eligible: 0, present: 0, absent: 0, excused: 0 },
        });
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
    const ar = language === "ar";
    await page.goto(new URL("/academic-management", base).href);
    if (role === "student") {
      await page.getByRole("heading", {
        name: "This tool is not available for your account",
      }).waitFor();
      assert(!calls.some((c) => c.path === "/rest/v1/course_definitions"));
      console.log(
        "PASS student: guarded module denied before loading academic resources.",
      );
      await context.close();
      continue;
    }
    await page.getByRole("heading", {
      name: ar
        ? "المواد والشعب الأكاديمية"
        : "Academic definitions and sections",
      exact: true,
    }).waitFor();
    if (role === "admin") {
      await page.getByLabel(ar ? "اسم المادة" : "Definition title", {
        exact: true,
      }).fill("Academic Fixture");
      await page.getByLabel(ar ? "رمز المادة" : "Course code", { exact: true })
        .fill("TEST101");
      await page.getByRole("button", {
        name: ar ? "حفظ تعريف المادة" : "Save definition",
        exact: true,
      }).click();
      await page.getByRole("button", { name: /TEST101 — Academic Fixture/ })
        .click();
      await page.getByRole("combobox", {
        name: ar ? "الدكتور المكلّف" : "Assigned instructor",
        exact: true,
      }).selectOption(teacher);
    } else {
      assert.equal(
        await page.getByRole("button", { name: "Save definition", exact: true })
          .count(),
        0,
      );
      await page.getByRole("button", { name: /M1 — Calculus/ }).click();
    }
    await page.getByLabel(ar ? "رقم/اسم الشعبة" : "Section label", {
      exact: true,
    }).fill("02");
    await page.getByLabel(ar ? "الفصل الدراسي" : "Academic term", {
      exact: true,
    }).fill("2026 Fall");
    await page.getByRole("button", {
      name: ar ? "إنشاء الشعبة" : "Create section",
      exact: true,
    }).click();
    await page.getByRole("heading", {
      name: "Calculus · 02 · 2026 Fall",
      exact: true,
    }).waitFor();
    const created = calls.find((c) =>
      c.path === "/rest/v1/rpc/create_academic_section"
    );
    assert.equal(created.data.p_instructor, role === "admin" ? teacher : id);
    await page.getByRole("button", { name: /عرض الطلاب|View students/ }).first()
      .click();
    await page.getByRole("cell", { name: "202600001", exact: true }).waitFor();
    assert(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth + 1
      ),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/${width}-${language}-${role}.png`,
      fullPage: true,
    });
    await page.getByRole("navigation", {
      name: ar ? "أنشطة الشعبة" : "Section activities",
      exact: true,
    }).first().getByRole("link", {
      name: ar ? "الحضور والغياب" : "Attendance",
      exact: true,
    }).click();
    await page.getByRole("heading", { name: "Y-Attendance", exact: true })
      .waitFor();
    await page.waitForFunction(
      (s) =>
        Array.from(document.querySelectorAll("select")).some((e) =>
          e.value === s
        ),
      section,
    );
    await page.goto(new URL("/online-lectures?section=forbidden", base).href);
    await page.getByRole("heading", {
      name: ar ? "المحاضرات المباشرة" : "Online lectures",
      exact: true,
    }).waitFor();
    assert.equal(
      await page.getByRole("combobox", {
        name: ar ? "الشعبة" : "Section",
        exact: true,
      }).inputValue(),
      "",
    );
    assert(
      !calls.some((c) =>
        c.path === "/rest/v1/academic_lectures" && c.query.includes("forbidden")
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}/${language}/${role}: creation, existing roster number, scoped attendance link, rejected foreign section and responsive layout.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
