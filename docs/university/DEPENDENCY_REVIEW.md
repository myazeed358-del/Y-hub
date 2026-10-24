# Dependency review — 2026-10-23

Full `pnpm audit --json` was compared with a fresh audit of the main lockfile/manifests at `8a5dde1b20f26161e7e26b8b0bf71ecd1097f136`. Both report **39 advisory entries: 7 critical, 13 high, 15 moderate, 4 low**. Advisory identities (package + advisory URL + affected range) are identical; no new advisory identity was introduced by the university dependencies. This is a registry snapshot, not proof of absence of vulnerabilities or exploitability of every reported path.

Earlier phase reports used `pnpm audit --prod`: 0 high/critical, one low KaTeX and one moderate postcss-selector-parser. That narrower result is NOT an overall security clearance. This workspace places some browser-bundled libraries under devDependencies; their runtime risk cannot be dismissed as development-only. Full audit returns a nonzero security status and is reported here, never suppressed as a passing security gate.

Pinned new packages include qrcode 1.5.4 and livekit-client 2.23.0; no advisory for those packages was reported. The inherited findings include PDF/HTML rendering, sanitization, mapping, worker pools and dev/test servers. Production exposure assessment and compatible dependency remediation remain a release gate. No broad unrelated dependency upgrade or math implementation change was made in this feature task.

Raw local evidence: `/tmp/university-audit-all.json`, `/tmp/university-audit-baseline.json`. The following durable advisory inventory records the comparison without credentials or user data.

| Package | Severity | Advisory |
|---|---|---|
| `@vitest/mocker` | moderate | [Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |
| `@vitest/mocker` | moderate | [Vitest: Code injection via unauthenticated manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) |
| `braces` | high | [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| `dompurify` | low | [DOMPurify: SMIL attributeName=href guard is skipped when PARSER_MEDIA_TYPE is application/xhtml+xml](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f) |
| `dompurify` | critical | [DOMPurify SAFE_FOR_TEMPLATES bypass: split template expressions survive in attached shadow root content on DOM output modes](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) |
| `dompurify` | high | [DOMPurify IN_PLACE: hook that removes a parent or sibling leaves the detached subtree's event handlers armed (incomplete fix for GHSA-p98j-92pf-mc4p)](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr) |
| `esbuild` | moderate | [esbuild enables any website to send any requests to the development server and read the response](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| `html2pdf.js` | high | [html2pdf.js contains a cross-site scripting vulnerability](https://github.com/advisories/GHSA-w8x4-x68c-m6fc) |
| `jspdf` | high | [jsPDF Affected by Client-Side/Server-Side Denial of Service via Malicious GIF Dimensions](https://github.com/advisories/GHSA-67pg-wm7f-q7fj) |
| `jspdf` | high | [jsPDF has a PDF Object Injection via FreeText color](https://github.com/advisories/GHSA-7x6v-j9x4-qf24) |
| `jspdf` | high | [jsPDF Vulnerable to Denial of Service (DoS) via Unvalidated BMP Dimensions in BMPDecoder](https://github.com/advisories/GHSA-95fx-jjr5-f39c) |
| `jspdf` | high | [jsPDF has a PDF Object Injection via Unsanitized Input in addJS Method](https://github.com/advisories/GHSA-9vjf-qc39-jprp) |
| `jspdf` | moderate | [jsPDF has Shared State Race Condition in addJS Plugin](https://github.com/advisories/GHSA-cjw8-79x6-5cj4) |
| `jspdf` | critical | [jsPDF has Local File Inclusion/Path Traversal vulnerability](https://github.com/advisories/GHSA-f8cm-6447-x5h2) |
| `jspdf` | high | [jsPDF has a PDF Injection in AcroForm module allows Arbitrary JavaScript Execution (RadioButton.createOption and "AS" property)](https://github.com/advisories/GHSA-p5xg-68wr-hm3m) |
| `jspdf` | high | [jsPDF has PDF Injection in AcroFormChoiceField that allows Arbitrary JavaScript Execution](https://github.com/advisories/GHSA-pqxr-3g65-p328) |
| `jspdf` | moderate | [jsPDF Vulnerable to Stored XMP Metadata Injection (Spoofing & Integrity Violation)](https://github.com/advisories/GHSA-vm32-vv63-w422) |
| `jspdf` | critical | [jsPDF has HTML Injection in New Window paths](https://github.com/advisories/GHSA-wfv2-pwc8-crg5) |
| `katex` | low | [KaTeX: Existing prototype pollution can bypass trust restrictions](https://github.com/advisories/GHSA-238p-pmpm-9mq7) |
| `maplibre-gl` | critical | [MapLibre GL JS: XSS Sanitizer Bypass in DOM.sanitize() via Live NamedNodeMap Removal Skip](https://github.com/advisories/GHSA-jrc7-96c5-q579) |
| `postcss-selector-parser` | moderate | [PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) |
| `source-map-js` | high | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| `tinypool` | critical | [Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) |
| `tinypool` | critical | [Tinypool: Prototype Pollution Gadget to RCE in run() options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) |
| `vite` | moderate | [Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) |
| `vite` | high | [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| `vite` | high | [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| `vite` | moderate | [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv) |
| `vite` | moderate | [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv) |
| `vite` | low | [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) |
| `vite` | low | [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) |
| `vite` | high | [vite: `server.fs.deny` bypass on Windows alternate paths](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) |
| `vite` | moderate | [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw) |
| `vite` | moderate | [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw) |
| `vite` | moderate | [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) |
| `vite` | moderate | [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) |
| `vite` | moderate | [launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) |
| `vitest` | critical | [When Vitest UI server is listening, arbitrary file can be read and executed](https://github.com/advisories/GHSA-5xrq-8626-4rwp) |
| `vitest` | moderate | [Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) |
