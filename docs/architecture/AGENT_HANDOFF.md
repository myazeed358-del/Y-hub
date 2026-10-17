# Agent handoff

CURRENT PHASE: audit/baseline complete; implementation next.
CURRENT WORK PACKAGE: initial recovery checkpoint.
LAST COMPLETED TASK: inspected main, existing refactor history, feature/math boundaries and verified baseline.
CURRENT BRANCH: refactor/architecture-plug-and-play
LAST VERIFIED REMOTE COMMIT SHA: cca4f313097cbcf72488234a8df601dd00a8df48 (main; refactor branch not yet pushed).
FILES MODIFIED: new AGENTS.md and architecture audit/baseline/progress/handoff documents.
FILES DELETED: none.
TESTS EXECUTED: baseline commands in TEST_BASELINE.md.
TEST RESULTS: 1558 TS/JS tests, 29 Python tests; workspace typecheck, main build and architecture checks passed.
KNOWN FAILURES: GitHub API PR list returns Forbidden; Supabase anonymous tables reject reads.
UNFINISHED WORK: implementation packages in REFACTOR_PROGRESS.md.
NEXT EXACT STEP: integrate existing engine-navigation commits 578e18e, d0fe224, d10ecb2, test, then implement manifest discovery.
RECOVERY COMMANDS: git status --short --branch; git log -8 --oneline; git ls-remote origin refs/heads/refactor/architecture-plug-and-play; read AGENTS.md and progress before editing.
IMPORTANT RISKS: preserve migrations, RLS, identifiers, themes, public math APIs; no authenticated backend verification; never reset unknown changes.
