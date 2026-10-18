#!/usr/bin/env bash
# Optional integration check without merging branches or creating a Git worktree.
# Requires dependencies prepared from the pinned security branch (mathjs 15.2.0).
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
base=57f3103b273285c27802e35f47189e16a8318035
refs=(e6a41004e899da4e1321cc9c10448cbfb63b4bd6 8f32d6eb20f60a0581617e56119f760b186a63fd ac778eec4b1671a74b3e3f49e1ce9be811a4fef3)
version="$(cd artifacts/y-hub && node -p "require('mathjs').version")"
[[ "$version" == 15.2.0 ]] || { echo 'Prepare dependencies from fix/mathjs-parser-security first (mathjs 15.2.0 required).' >&2; exit 1; }
bundle="$(mktemp -d /tmp/yhub-phase1-source.XXXXXX)"
trap 'rm -rf -- "$bundle"' EXIT
git archive HEAD | tar -x -C "$bundle"
for ref in "${refs[@]}"; do
  git merge-base --is-ancestor "$base" "$ref"
  # This review contains no source deletions; refuse rather than silently miss one.
  [[ -z "$(git diff --name-only --diff-filter=D "$base" "$ref" -- artifacts pnpm-lock.yaml scripts)" ]]
  mapfile -t paths < <(git diff --name-only "$base" "$ref" -- artifacts pnpm-lock.yaml scripts)
  git archive "$ref" "${paths[@]}" | tar -x -C "$bundle"
done
# Reuse the verified installed dependency tree; never modify tracked source through it.
for path in node_modules artifacts/y-hub/node_modules artifacts/y-hub-ds/node_modules artifacts/mockup-sandbox/node_modules; do
  if [[ -d "$root/$path" ]]; then ln -s "$root/$path" "$bundle/$path"; fi
done
printf 'Testing exported source snapshot with all three implementation commits; no Git merge is performed.\n'
bash "$bundle/scripts/verify-architecture-refactor.sh"
printf 'PASS: combined source snapshot (exam + course + dependency fixes)\n'
