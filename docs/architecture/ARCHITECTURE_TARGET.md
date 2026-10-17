# Target architecture

Y-Hub remains a modular monolith: React/Vite presentation, feature-owned application logic/repositories, reusable mathematical services, and existing Supabase authorization. No new microservices or database model are introduced.

- Application bootstrap owns providers and the host router.
- Host routes own authentication, course IDs, enrollment and account workflows.
- src/modules owns discovery, validation, selection, UI access policy and lazy composition. It never owns database grants.
- src/modules/<id>/module.ts contributes metadata and lazy routes through public feature entry points.
- Features own domain logic, UI, hooks and infrastructure where those responsibilities exist. Small features do not need empty architectural layers.
- Math engines retain services/math/ports and MathEngineRegistry as computation contracts. UI module discovery does not imply a new mathematical algorithm or new operation classification.
- Supabase repositories/RPCs and RLS remain the trusted data boundary. Student numbers and course content continue to use existing stable IDs.

Existing compatibility facades remain until their consumers and contracts are conclusively obsolete. Do not rewrite tested numerical/proof algorithms for style. Module-level tests plus existing math/course/enrollment tests are the regression baseline.
