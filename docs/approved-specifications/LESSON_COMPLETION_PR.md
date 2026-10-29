## Lesson completion without fabricated progress

Implement approved decisions 27/41 in the existing course-syllabus and learning-path views. Students can mark topics complete/incomplete or return to automatic rules. Assigned instructors choose manual/all/any submitted exams in the same section. Opening lessons does not complete them; exam grades and practice performance are separate.

Add 0046 with self-only progress RLS, current-role/enrollment/ownership validation, guarded RPC writes, CAS conflicts, idempotent retries and mandatory audit capture. Reuse existing topics, exam submissions and section permissions. Conditions/progress survive edits to retained topics. Update Arabic/English controls, RTL numeric isolation, audit entity filters and regression tests. No math, Sheets, historical migration or Vercel changes.

## Verification

- Full architecture script: 2139 Vitest tests / 246 files; 36 Python; 8 architecture guard tests; all workspace TypeScript, boundary audits and production build PASS.
- 71 academic SQL/RLS tests; 39 audit tests plus 1 concurrent upgrade; immutable-number SQL assertions PASS.
- 77 native local Auth/JWT/PostgREST cases PASS (3 new completion scenarios).
- 4 Chromium route/UI scenarios PASS at 390/1280 pixels, Arabic/English, light/dark; browser APIs are intercepted separately from native HTTP tests.
- 51 focused syllabus tests are a subset of the full Vitest count. Final failures: 0.

## Deployment and limits

Keep Draft for review. Additive `0046_lesson_completion.sql` was applied only in isolated local tests and must precede the client. Production migration work for prior merged changes is authorized but blocked by missing administrative database access/ledger; no production write occurred. Do not replay historical SQL blindly or automatically merge this new package.

First supported automatic activity: current published same-section exam with a real submitted attempt, regardless of score. No automatic credit for PDF opening, simulated AI Practice, or legacy results without attempt evidence. Future activity types need server verification. Staging/deployment validation remains PENDING. Existing PDF.js/chunk/Starlette warnings and deferred Vercel Python bundle-size issue remain.

Full evidence, affected files, authorization and remaining work: `docs/approved-specifications/LESSON_COMPLETION.md`. Decision progress: 24 complete locally, 19 partial, 28 missing out of 71; recommendations 72–80 excluded.
