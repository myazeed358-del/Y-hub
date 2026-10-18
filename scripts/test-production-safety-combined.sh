#!/usr/bin/env bash
# Compose only SQL/test files from independently reviewed commits. No worktree,
# application merge, database URL, production access or remote writes are used.
set -euo pipefail
cd "$(dirname "$0")/.."
exam_ref="$(git rev-parse --verify "${YHUB_EXAM_REF:-e6a41004e899da4e1321cc9c10448cbfb63b4bd6}^{commit}")"
course_ref="$(git rev-parse --verify "${YHUB_COURSE_REF:-8f32d6eb20f60a0581617e56119f760b186a63fd}^{commit}")"
bundle="$(mktemp -d /tmp/yhub-phase1-combined.XXXXXX)"
trap 'rm -rf -- "$bundle"' EXIT
# Every child runner creates and destroys its own network-disabled PostgreSQL container.
git archive HEAD artifacts/y-hub/supabase/migrations artifacts/y-hub/supabase/tests scripts/test-audit-log.sh scripts/test-y-sheets.sh | tar -x -C "$bundle"
git archive "$exam_ref" artifacts/y-hub/supabase/migrations/0025_exam_attempt_integrity.sql artifacts/y-hub/supabase/tests/exams scripts/test-exam-attempts.sh | tar -x -C "$bundle"
git archive "$course_ref" artifacts/y-hub/supabase/migrations/0026_confirm_course_deletion.sql artifacts/y-hub/supabase/tests/courses scripts/test-course-deletion.sh | tar -x -C "$bundle"
# Include the role-matrix regression from the current verification checkout.
cp artifacts/y-hub/supabase/tests/y-sheets/test_saves.py "$bundle/artifacts/y-hub/supabase/tests/y-sheets/test_saves.py"
printf 'Combined migration verification: exam %s; courses %s\n' "$exam_ref" "$course_ref"
for suite in exam-attempts course-deletion audit-log y-sheets; do
  bash "$bundle/scripts/test-$suite.sh"
done
printf 'PASS: combined 0025/0026 with exam, course, audit and workbook SQL suites\n'
