#!/usr/bin/env bash
# Verify independent PR source together without merging branches or editing main.
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
base=8a5dde1b20f26161e7e26b8b0bf71ecd1097f136
refs=(56e5e3303e66a759336ec9a6ad2f474ea1ee4941 a9a814ef1e4b2a427d0357d18cdf79cfa83b9274 bb199ef0b54d5e50cba83043612d81cd94187fe8)
bundle=$(mktemp -d /tmp/yhub-phase3-verify.XXXXXX)
trap 'rm -rf "$bundle"' EXIT
git archive HEAD | tar -x -C "$bundle"
for ref in "${refs[@]}"; do
  mapfile -t paths < <(git diff --name-only "$base" "$ref" -- artifacts scripts docs)
  if ((${#paths[@]})); then git archive "$ref" -- "${paths[@]}" | tar -x -C "$bundle"; fi
done
ln -s "$repo/node_modules" "$bundle/node_modules"
for artifact in y-hub y-hub-ds mockup-sandbox; do
  ln -s "$repo/artifacts/$artifact/node_modules" "$bundle/artifacts/$artifact/node_modules"
done
cd "$bundle"
bash scripts/test-supabase-http.sh
if [[ "${1:-}" != --http-only ]]; then
  bash scripts/verify-architecture-refactor.sh
  for suite in academic audit-log exam-attempts course-deletion y-sheets; do bash "scripts/test-$suite.sh"; done
fi
printf 'PASS: Phase 3 independent source export verified; no Git merge performed\n'
