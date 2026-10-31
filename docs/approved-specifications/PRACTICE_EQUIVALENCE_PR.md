## Prevent equivalent polynomial derivative exercises from repeating

AI Practice previously compared normalized prompt text, so a renamed variable, translated question or changed constant could repeat a solved derivative. Migration0051 adds a private, indexed input identity and checks the actor's section history under the existing publication lock. It preserves old attempts and explicit retraining, rejects same-session duplicates, and prevents concurrent devices from admitting equivalent proposals.

The existing worker gets bounded structured history and returns a safe duplicate message; the existing bilingual UI retains the current session and offers an explicit retry. No extra provider call is made automatically. Current authorization, delayed feedback, verified scoring and review suspension remain intact.

Validation:2259 Vitest/258files,36Python,134academicSQL +1populated practice upgrade,39auditSQL +1concurrent audit upgrade,105native local Auth/JWT/PostgREST,21Chromium cases; workspace/worker TypeScript,architecture/boundaries,artifact drift andproduction build PASS. Three new regressions failed against0050 before the fix; all final tests pass.

Decision17 advances within the existing bounded first-derivative contract; arbitrary mathematical/theoretical equivalence remains incomplete. See `docs/approved-specifications/PRACTICE_EQUIVALENCE.md`.0051 is tested locally including upgrade from populated0050; production migration and hosted Staging/provider checks remain pending because no administrative DB connection is available. No Edge deployment or automatic merge. Known Vercel Python size issue is deferred.
