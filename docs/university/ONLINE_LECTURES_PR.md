Add section-bound online lectures using the existing academic lecture model. The API-v2 application supports scheduling, upcoming lectures, video/audio, screen sharing, bounded transient chat and participant removal through a replaceable LiveKit adapter.

Supabase Auth + current database authorization controls short-lived media admission. Audited participant blocks survive provider failures; a separately authenticated server reconciler retries disconnection and checks current enrollment/roles/time. New migration0036 distinguishes online from in-person lectures. No browser service keys or public room bypass.

Base: `feature/y-attendance`. Verification, required SFU/scheduler setup and explicit staging/media limitations: [ONLINE_LECTURES.md](docs/university/ONLINE_LECTURES.md). Keep Draft. Not production-ready until configured provider, reconciliation and staging gates pass. No main merge or production migration.
