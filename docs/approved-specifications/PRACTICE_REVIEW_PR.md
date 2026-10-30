## AI Practice recheck and scoped human review

Previously a saved practice answer only had an unverified AI suggestion. Students can now request a server-owned automatic recheck, then explicitly ask their assigned course reviewer for a human resolution. Confirmed review results include only resolved valid questions; pending and excluded answers are never treated as wrong. Existing Tutor pages provide bilingual review controls, trusted mathematical evidence and a paginated reviewer queue.

Additive migration0049 protects answer details in a private schema and enforces current enrollment/assignment, no self-review, explicit sharing, CAS/idempotency and atomic audit. Service-only publication accepts evidence from the stored source snapshot; browser input is only a review ID. Provider failure remains visibly unavailable and does not create a grade. Admin/Owner status grants no platform-wide private-answer access. Historical SQL, engines, Sheets and Vercel are unchanged.

Decisions23/39 are implemented for the existing MCQ flow. Engine/free-form hybrid grading18, adaptive practice and weighted performance remain incomplete. This is not an official university grade.

Validation: **2,217 Vitest/256 files;36 Python;112 academic PostgreSQL;39 audit +1 concurrent upgrade;94 native local Auth/JWT/PostgREST;17 browser cases;8 architecture guards;workspace/shared-worker TypeScript,strict boundaries and production build PASS**. No final failures. Browser/provider fixtures are distinguished from actual local service integration in [PRACTICE_REVIEW.md](docs/approved-specifications/PRACTICE_REVIEW.md).

Production migration remains authorized but blocked by missing administrative connection/ledger/network access;0049 is local-only. The new Edge entry is not deployed. Hosted Staging/provider validation is pending. The prior sessions group is already merged into maincc62fd4; this subsequent review branch must remain independently reviewed. Vercel Python bundle-size issue is known/deferred. Do not merge or deploy this new group automatically.
