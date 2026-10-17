# Agent handoff

CURRENT PHASE: audit/baseline complete; implementation next.
CURRENT WORK PACKAGE: reuse existing navigation catalog work.
LAST COMPLETED TASK: inspected main, existing refactor history, feature/math boundaries and verified baseline.
CURRENT BRANCH: refactor/architecture-plug-and-play
LAST VERIFIED REMOTE COMMIT SHA: 3caa3b525c51ad330efb249b1809a3d955555a81 (verified refactor branch checkpoint).
FILES MODIFIED: new AGENTS.md and architecture audit/baseline/progress/handoff documents.
FILES DELETED: none.
TESTS EXECUTED: baseline commands in TEST_BASELINE.md plus three navigation/search suites (33 tests) and app typecheck.
TEST RESULTS: 1558 TS/JS tests, 29 Python tests; workspace typecheck, main build and architecture checks passed.
KNOWN FAILURES: GitHub API PR list returns Forbidden; Supabase anonymous tables reject reads.
UNFINISHED WORK: implementation packages in REFACTOR_PROGRESS.md.
NEXT EXACT STEP: implement typed module manifests and discovery; navigation commits 578e18e, d0fe224, d10ecb2 have been reused as fd66dff, e6b2bfa, c1507b0.
RECOVERY COMMANDS: git status --short --branch; git log -8 --oneline; git ls-remote origin refs/heads/refactor/architecture-plug-and-play; read AGENTS.md and progress before editing.
IMPORTANT RISKS: preserve migrations, RLS, identifiers, themes, public math APIs; no authenticated backend verification; never reset unknown changes.
