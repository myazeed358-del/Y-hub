# Owner display name

Independent branch from verified main8a5dde1b20f26161e7e26b8b0bf71ecd1097f136. Profile, dashboard, application-shell identity and Audit Log role labels now display **Owner** in both languages; restricted audit copy references Owner. Internal `super_admin` values, SQL policies, route guards, access checks and API parameters are unchanged. No migration or new permissions.

Verification:1855 Vitest/211 files,29 Python,91 isolated PostgreSQL (30 academic,26 audit,16 exams,9 deletion,10 Y-Sheets),workspace TypeScript,strict architecture/math/module audits,eight boundary guards and production build. The existing identity test now asserts Owner for the original internal role. Production/staging role changes were not executed. Other university branches remain independently preserved; combined integration follows.
