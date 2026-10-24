## Trusted section knowledge for the existing AI Tutor

The Tutor previously sent browser-selected PDF excerpts and unverified page labels to Groq, reprocessing the first PDF on each visit. This change makes the server select and authorize evidence from a persisted per-section index, with real source/page snippets, invalidation and current-role/enrollment checks.

- Keep the existing course route and API v2 boundaries; no duplicate Tutor or course model.
- Add instructor-managed PDF/syllabus indexing, bounded extraction, optional semantic embeddings plus PostgreSQL text search, and atomic generation-checked publication.
- Reject browser-authored evidence and provider-invented citation IDs; revalidate session/access/source generation after provider calls.
- Preserve 10/user/hour and 100/platform/day quotas; add actor/platform concurrency leases and bounded requests/context/output.
- Improve the current UI with source selection, indexing status, expandable evidence, KaTeX, bilingual notices and session-only conversations cleared on access/account loss.

Migration **0038_ai_tutor_knowledge.sql** is local-tested only. No production SQL or Edge deployment, no main merge. Requires approved hosted deployment with server-only keys and an exact CORS origin allowlist. Actual external Groq/embedding calls and hosted Storage/Edge integration remain pending; local mocks are not claimed as live model verification.

See `docs/ai-tutor/PHASE1.md`, `VERIFICATION.md` and `CHANGED_FILES.md` for limits, test results and deployment gates. Phases 2 (educational modes) and 3 (verified math tool integration) are deliberately not included. Known Vercel Python bundle-size limitation is deferred and unchanged.
