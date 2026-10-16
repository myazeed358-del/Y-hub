# Y-Hub account numbers — implementation

Agreed format: exactly nine ASCII digits `YYMMNNNNN`: local registration
year (`YY`), month (`MM`), and a shared monthly 1–99999 sequence (`NNNNN`).

- The generator runs in Supabase Postgres. Never generate numbers in React.
- Internal authentication IDs stay UUIDs, unchanged throughout existing references.
- Each issued number is reserved permanently in `yhub_internal.user_number_issues`,
  which has NO cascading FK to `auth.users`.
- Month boundaries are interpreted in `Asia/Amman` from the authentic
  `auth.users.created_at` value. The allocator is atomic under concurrent signups.
- Existing `public.users` profiles are backfilled based on original signup dates.
  Backfill numbers are retroactive, not evidence of original registration order
  outside the available auth timestamp. The nine-digit scheme permits 99,999
  registrations per month; extending the scheme later requires a new version.
- The profile displays the number read-only in Arabic and English.

## Deployment steps

1. Run the installer from a clean **feature branch** in `artifacts/y-hub`.
2. Review `git diff` and run `pnpm typecheck` and
   `pnpm test --run src/features/profile/components/__tests__/ProfileAccountInfo.test.tsx`.
3. Commit and open a PR; merge only after review and green checks.
4. Back up the Supabase DB and run `pnpm dlx supabase db push --dry-run`
   from `artifacts/y-hub` to confirm exactly what would be applied.
5. Apply 0018 to **staging** before production, then test a real signup, role
   change, delete, and number immutability. The SQL smoke test uses ROLLBACK.
6. Once verified, deploy the migration to production and then the frontend.
   Do NOT consider committing the file a DB deployment.

If migration 0018 already exists under another name, stop and resolve it rather
than blindly creating a conflicting migration.
