# Reachable parser dependency security

Independent branch `fix/mathjs-parser-security`, based on main `57f3103b273285c27802e35f47189e16a8318035`. No mathematical engine implementation, formula or algorithm is changed.

## Evidence and fix

The phase audit found **GHSA-29qv-4j9f-fjw5** and **GHSA-jvff-x2qm-6286** affecting installed mathjs 13.2.3. This is not safely dismissible as a dev-only package: `src/utils/mathEngine.ts` evaluates expressions using mathjs and calculus consumers import the parser. Some canonical engine paths validate/limit their AST, but that does not establish protection for every consumer.

Reviewed upstream fixes `513ab2a0e01004af91b31aada68fae8a821326ad` (restrict raw-array property writes) and `24d5ee7e25e85d49619b09122f055db4139bc057` (require genuine array indices). Added two benign regression probes: replacing a raw array's map property through an expression, and supplying an array-like matrix index. Both fail on 13.2.3; both pass on **15.2.0**. These probes neither execute arbitrary code nor access processes, files, network or real data.

The dependency is pinned exactly to 15.2.0; the lockfile changes only mathjs and its required fraction.js 4→5 dependency. No unrelated version churn. A major library upgrade is reviewable independently because parser semantics can change even when regression coverage passes; representative staging calculations remain required.

## Audit comparison

Full audit before: **6 critical, 12 high, 8 moderate, 1 low**.
After this branch: **6 critical, 10 high, 8 moderate, 1 low**.
Exactly the two mathjs advisory IDs disappear; no IDs are added. Audit still exits nonzero and is **not** an approval or waiver for the remaining findings.

## Remaining findings and reachability

| Family | Reviewed trigger / observed code path | Status |
|---|---|---|
| jsPDF Node LFI (critical) | Requires Node build loadFile/addImage/html/addFont with untrusted paths. Y-Hub backend is Python; observed export is browser html2pdf. No such Node server path found. | Trigger not found in reviewed app path; package still affected |
| jsPDF new-window HTML injection (critical), AcroForm/addJS/annotation/metadata | Reviewed app uses `.from(element).save()` in AITutorHeader, not new-window output, AcroForm, addJS, annotations or metadata APIs. | Trigger not found in current reviewed export; no blanket future-use exemption |
| html2pdf XSS | Advisory requires an HTML string source. Current AITutorHeader passes a DOM element. | Specific string-source trigger not used; keep dependency update on backlog |
| jsPDF GIF/BMP allocation DoS | Current PDF path captures DOM via html2canvas and uses JPEG output; no direct untrusted GIF/BMP bytes passed to jsPDF were found. | Specific parser trigger not found; broader malicious resource/DOM handling remains a separate review |
| MapLibre sanitizer XSS (critical) | Transitive Plotly dependency; no direct app MapLibre attribution API use found. | Full transitive runtime reachability not proven absent; **NOT FIXED**, release review required |
| Vitest / mocker / tinypool (including critical), Vite / esbuild | Dev/test tooling; these runs use batch Vitest without its UI server. Windows-specific paths are not exercised on this Linux environment. | No demonstrated trigger in these commands; **NOT FIXED** for other deployment/developer modes; do not expose vulnerable dev/UI servers publicly |
| braces / source-map-js / postcss-selector-parser | Build/test parser dependency risks with attacker-controlled patterns, maps or selectors. | **NOT FIXED**; no untrusted build inputs used in this review, separate tooling updates required |
| KaTeX | Prototype-pollution-dependent trust bypass; runtime KaTeX exists in other features. | **NOT FIXED**; removing mathjs vulnerabilities does not prove all pollution sources absent |

Y-Sheets uses its own formula parser/evaluator, not mathjs, and its Excel worker imports @e965/xlsx and fflate. These scope facts do not make the whole same-origin application immune to unrelated XSS. No hostile exploit was executed against production. Findings without a demonstrated reachable trigger are not claimed globally unexploitable.

## Verification

- Baseline: **2 regression tests failed** on 13.2.3.
- Patched: **2 regression tests passed** on 15.2.0.
- Full compatibility verification: **1,792 Vitest tests / 202 files**, **29 Python tests**, **8 module-boundary guard tests**, complete workspace TypeScript, architecture/math/module checks and production build passed. No failed or skipped tests in final runs; existing chunk/deprecation warnings remain. Frozen lockfile validation and `git diff --check` passed.
- No production migration or database operation; no dependency audit suppression, test disabling or security-check bypass.
