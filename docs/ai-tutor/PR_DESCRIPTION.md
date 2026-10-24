## Trusted section knowledge for the existing AI Tutor

The Tutor previously sent browser-selected PDF excerpts and unverified page labels to Groq, reprocessing the first PDF on each visit. This change makes the server select and authorize evidence from a persisted per-section index, with real source/page snippets, invalidation and current-role/enrollment checks.

- Keep the existing course route and API v2 boundaries; no duplicate Tutor or course model.
- Add instructor-managed PDF/syllabus indexing, bounded extraction, optional semantic embeddings plus PostgreSQL text search, and atomic generation-checked publication.
- Reject browser-authored evidence and provider-invented citation IDs; revalidate session/access/source generation after provider calls.
- Preserve 10/user/hour and 100/platform/day quotas; add actor/platform concurrency leases and bounded requests/context/output.
- Improve the current UI with source selection, indexing status, expandable evidence, KaTeX, bilingual notices and session-only conversations cleared on access/account loss.

Migrations **0038_ai_tutor_knowledge.sql** and **0039_ai_tutor_arabic_search.sql** are local-tested only. The follow-up adds safe delimiter normalization, isolated LTR math/RTL prose, Auto/Arabic/English explanation selection and Arabic-normalized retrieval; see `MATH_ARABIC.md` for examples and deployment order. No production SQL or Edge deployment, no main merge. Requires approved hosted deployment with server-only keys and an exact CORS origin allowlist. Actual external Groq/embedding calls and hosted Storage/Edge integration remain pending; local mocks are not claimed as live model verification.

See `docs/ai-tutor/PHASE1.md`, `VERIFICATION.md` and `CHANGED_FILES.md` for limits, test results and deployment gates. Phases 2 (educational modes) and 3 (verified math tool integration) are deliberately not included. Known Vercel Python bundle-size limitation is deferred and unchanged.

Latest follow-up validation: **1994 Vitest /229 files** (99 Tutor tests), **36 Python**, **8 architecture guards**, workspace TypeScript/audits/build, both Edge Deno typechecks, **20 native Auth/HTTP/database cases**, and **5 Chromium scenarios** passed. The earlier Phase 1 checkpoint separately verified 4 real PDF tests and 134 existing SQL cases. Browser/LLM fixtures are explicitly distinguished from native local services in `MATH_ARABIC.md` and `VERIFICATION.md`; live Arabic provider generation and hosted Storage/Edge tests remain pending.
