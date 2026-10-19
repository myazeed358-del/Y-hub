#!/usr/bin/env bash
# Test the independent fullscreen and academic branches without Git merging/worktrees.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
base=b86dc42
fullscreen=39dd464dc67b29ccf5b03eca5651213cd93ca13e
bundle="$(mktemp -d /tmp/yhub-phase2-source.XXXXXX)"
server_pid=''
cleanup() { if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi; rm -rf -- "$bundle"; }
trap cleanup EXIT
git archive HEAD | tar -x -C "$bundle"
git merge-base --is-ancestor "$base" "$fullscreen"
[[ -z "$(git diff --name-only --diff-filter=D "$base" "$fullscreen" -- artifacts/y-hub/src scripts/test-fullscreen-browser.mjs)" ]]
mapfile -t paths < <(git diff --name-only "$base" "$fullscreen" -- artifacts/y-hub/src scripts/test-fullscreen-browser.mjs)
git archive "$fullscreen" "${paths[@]}" | tar -x -C "$bundle"
for path in node_modules artifacts/y-hub/node_modules artifacts/y-hub-ds/node_modules artifacts/mockup-sandbox/node_modules; do
  if [[ -d "$root/$path" ]]; then ln -s "$root/$path" "$bundle/$path"; fi
done
bash "$bundle/scripts/verify-architecture-refactor.sh"
if [[ "${YHUB_PHASE2_BROWSER:-0}" == 1 ]]; then
  (cd "$bundle/artifacts/y-hub"; exec node "$root/artifacts/y-hub/node_modules/vite/bin/vite.js" --host 127.0.0.1 --port 5176 --strictPort) > /tmp/phase2-combined-vite.log 2>&1 &
  server_pid=$!
  for attempt in $(seq 1 60); do
    if curl --silent --fail http://127.0.0.1:5176/ >/dev/null; then break; fi
    kill -0 "$server_pid" || { cat /tmp/phase2-combined-vite.log; exit 1; }
    sleep .25
  done
  YHUB_BROWSER_BASE_URL=http://127.0.0.1:5176 node "$bundle/scripts/test-fullscreen-browser.mjs"
  YHUB_BROWSER_BASE_URL=http://127.0.0.1:5176 node "$bundle/scripts/test-syllabus-browser.mjs"
fi
printf 'PASS: combined Phase 2 source export, no Git merge performed\n' 
