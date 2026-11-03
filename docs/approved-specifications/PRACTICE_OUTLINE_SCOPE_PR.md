## Add instructor-authored PDF chapter and topic scopes to AI Practice

Students can now select one or more chapters/topics in the existing practice source panel. Assigned instructors map names to actual indexed physical pages. The server resolves IDs to the exact page union and rejects stale mappings, foreign sources and forged/widened scopes. Publication freezes teacher-authored chapter/topic names into private citations, released only after the existing answer/submission gates. Manual page scopes, existing session history, math engines and quotas remain compatible.

Migration0054 adds an RPC-only, forced-RLS outline store, live role/assignment checks, revision conflicts, idempotent retries and required redacted audit. Mapping/source changes invalidate dependent sessions and exclude them from performance aggregates without deleting history. The bilingual editor explains that even a title change invalidates prior chapter sessions. Names are teacher-authored, not automatically extracted or academically verified; only indexed physical PDF pages are supported.

Validation:2323Vitest/262files,36Python,182academicSQL/RLS,120native local Auth/JWT/PostgREST,4populated practice upgrades,39auditSQL+1audit upgrade,33Chromium cases. Workspace TypeScript,strict architecture/math/module boundaries,8guard cases,math artifact drift andproduction build PASS. Final failures0. Browser/provider fixtures are not hosted Supabase evidence.

Based on main613c8b9 (previous adaptive/performance work now merged with user authorization). Decision20 completes locally and22 gains reliable chapter/topic citations;42 remains partial for detailed topic reports. No historical migration changes, production writes, Edge deployment or automatic merge of this branch.0054 is local-only; production administrative connection, hosted Staging and scale testing remain pending. Existing Vercel Python size issue remains deferred. See `docs/approved-specifications/PRACTICE_OUTLINE_SCOPE.md` for all limits and files.

GitHub API is blocked in the current environment; this is a prepared PR description, not evidence that a PR has been opened.
