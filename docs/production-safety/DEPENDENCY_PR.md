## Problem and result
The installed mathjs 13.2.3 has two expression-parser sandbox vulnerabilities (GHSA-29qv-4j9f-fjw5 and GHSA-jvff-x2qm-6286). Y-Hub evaluates expressions through this runtime library, so its devDependencies placement is not a reason to dismiss the findings.

Pin mathjs to patched 15.2.0 and update only its lockfile subtree (including the required fraction.js dependency). No engine implementation, algorithm, route or database changes. Two benign upstream regression probes failed on 13.2.3 and pass on 15.2.0; they do not execute arbitrary code or touch real data.

## Verification
1,792 Vitest tests / 202 files, 29 Python tests, 8 boundary guard tests, complete workspace TypeScript/architecture and production build passed. Frozen-lockfile check passed. Full audit drops from 12 to 10 high advisories, with exactly the two mathjs IDs removed and none added; 6 critical, 8 moderate and 1 low remain. The audit remains nonzero, not waived.

## Review limits
This is a major dependency upgrade and requires representative staging calculations despite passing regression coverage. Current browser PDF export does not use the advisory-specific Node/new-window/AcroForm/addJS paths; transitive MapLibre and remaining tooling/runtime findings are not globally proven unexploitable. See [security evidence and remaining reachability review](docs/production-safety/DEPENDENCY_SECURITY.md).

Draft review only; do not merge automatically. No production mutations or migration application.
