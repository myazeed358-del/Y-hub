## Problem and resulting behavior

Decision26: the legacy learning home/plan presented fixed Fuzzy Logic lessons,37% progress and fictitious completion regardless of enrollment. Both existing routes now compose the actual course-syllabus feature: bounded section directory, explicit selection by section ID, current units/topics and existing course-material links.

Remove fabricated personal progress while retaining the standalone fuzzy reference articles, lab, quiz and their URLs. Distinguish syllabus completion from practice performance without inventing data. Read-only reload failures clear stale syllabus presentation; editor draft handling stays intact.

## Permissions / scope

No new SQL migration or authorization policy. Existing RLS and read_course_syllabus enforce active enrollment/publishing, section ownership and current roles. Directory filters do not substitute for these checks. Pending completion27/41 and performance42 are separate packages. No new module/dashboard/QuickAccess or changes to mathematical algorithms.

## Verification

| Verification | Result |
|---|---|
| Full `scripts/verify-architecture-refactor.sh` | PASS:2127Vitest /244files;36Python;8architecture guard tests;full workspace TypeScript;strict architecture/math/module boundaries;production build |
| Targeted learning/syllabus/reference tests |68PASS (subset of2127), including a final exact accessible-label regression rerun |
| `scripts/test-academic.sh` |55PostgreSQL/RLS tests PASS plus immutable-number checks |
| `scripts/test-supabase-http.sh` |74real localAuth/JWT/PostgREST tests PASS;four new learning-path cases, existing exam/Sheets/audit/Tutor/attendance contracts retained |
| `scripts/test-learning-path-browser.mjs` |4PASS:home390pxArabic/dark/student,home1280pxEnglish/light/instructor,plan390pxArabic/light/student,plan1280pxEnglish/dark/admin |

Final failed tests:0. Browser screenshot evidence was inspected locally; source harness is committed. Unit fixtures do not substitute for the separate native HTTP authorization tests.

Browser tests use intercepted APIs; native HTTP tests use actual local GoTrue/JWT/PostgREST. Hosted Staging remains PENDING. Full evidence/remaining limits:docs/approved-specifications/LEARNING_PATH.md.

No production writes/migrations/deployments or main merge. Keep Draft for review. Vercel Python bundle-size issue remains deferred.
