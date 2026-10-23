Close three demonstrated database authorization/grant gaps: prevent exam RPC access through unpublished parent sections, remove former-owner enrollment visibility after demotion, and remove non-DML table privileges that bypass RLS. Add migration 0029, preserving all historical migrations.

Conditionally harden the platform rls_auto_enable event-trigger function if present, without replacing its body. A fixture tests that path; the actual staging definition still needs inspection. Regression tests reproduce the three failures before the fix. See docs/phase3/SECURITY.md and the final verification report for results and limits.

Keep Draft. No production migration or automatic merge. Vercel Python bundle size is a known deferred issue, not part of this change.
