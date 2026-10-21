Y-Sheets now occupies the viewport without the host sidebar/header, using validated optional API-2 route layout metadata. Standard pages keep AppShell. The existing workbook recovery journal protects internal navigation and browser Back/Forward; conflicts and failed local recovery cannot silently discard the editor.

Verified: complete suite 1830 Vitest/208 files, 29 Python, eight boundary tests, workspace TypeScript, architecture audits and production build; CSS suite 5/5 includes one additional final assertion; local PostgreSQL Y-Sheets 10 tests + historical RLS assertions. Chromium passes 16 viewport/language/theme cases plus conflict recovery, shell restoration and guest denial, using synthetic intercepted HTTP only.

See docs/phase2/FULLSCREEN.md for evidence, limitations and repeatable browser command. No migrations, production writes, math changes or dependency changes. Real Supabase staging remains PENDING. Keep Draft; do not merge or waive CI/Vercel checks.
