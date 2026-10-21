# Y-Hub module contract (API 2)

## Add a module
Create src/modules/<unique-kebab-id>/module.ts exporting a default object satisfying ModuleManifest (import its type from ../contracts). No central registry, AppRoutes, engine catalog, sidebar array or translation-table edit is needed.

Required fields: id, version (major.minor.patch), apiVersion: 2, kind, category, title {ar,en}, access.roles, and nonempty routes. Each route has a static lowercase absolute path and load: () => import('@/features/my-feature'). Expose the component as the feature's default public export.
Optional metadata: description, keywords, capabilities, dependencies (module IDs), defaultEnabled, route.order, route.navigation and route.dashboard. Dashboard contributions provide their own localized title, iconId and order, sharing the same access checks.
Navigation requires group, iconId and order; title can be supplied locally, or use an existing UiKey labelKey for backward-compatible translations. New localized titles require no global translation edits.

See src/modules/discovery-example/module.ts and ExamplePage.tsx for a disabled working example. Integration tests enable it through createModuleRegistry(discoveredModules, {enabledIds: ['discovery-example']}) and render the real AppRoutes and SidebarNavigation. The fixture is not a new user-facing product.

## Classification and presentation

These fields answer independent questions. None derives authorization from the others.

| Field | Contract | Purpose |
|---|---|---|
| `kind` | `engine`, `application`, `laboratory` | Primary product identity; only engines enter engine-specific catalogs/search/tooltips |
| `category` | `mathematics`, `physics`, `chemistry`, `biology`, `medicine`, `engineering`, `productivity`, `education`, or `custom:<slug>` | Subject/product category; custom lowercase kebab-case subjects require no host edit |
| `capabilities` | Optional kebab-case descriptive tags | Advertised capabilities, never permissions or an engine-classification override |
| `access` | Explicit roles, optional majors/restricted roles and resource permissions | Existing frontend eligibility policy; backend enforcement remains mandatory |
| `routes[].navigation` | Optional contribution with `group`, localized title/label, icon and order | Sidebar destination and presentation; independent of kind/category |
| `routes[].dashboard` | Optional localized title, icon and order | Shared dashboard tool area for any kind; preserves existing flat layout |

The sidebar supports `learning` (Learning space), `tools` (Understanding tools), `applications` (Applications) and `laboratories` (Laboratories), in that order. Empty additional areas are omitted. Module links sort by their existing order/path within the declared area; learning contributions follow the host overview/practice links. These are presentation destinations, not registration lists. A module can deliberately select a different area without changing its kind. Omitting `navigation` hides the sidebar contribution; routes and optional dashboard entries remain independently available under their access policy.

For example, a future document application would declare `kind: 'application'`, `category: 'productivity'` and `navigation.group: 'applications'`. A future virtual experiment would declare `kind: 'laboratory'` and `navigation.group: 'laboratories'`. A physics computation engine remains `kind: 'engine'` even when its permitted academic major is engineering. These are contract examples only; no new application, scientific engine or laboratory is shipped in this change.

All seven existing mathematical tools remain `kind: 'engine'`, category mathematics, in the tools area. Fuzzy Logic Lab remains an engine because it provides the existing interactive membership-function computation; its product name and flask icon do not dictate its primary kind. Its `/lab` route, search inclusion, tooltip, major restrictions, sidebar position and Statistics dashboard contribution remain unchanged. A future standalone laboratory is classified independently and does not enter engine search merely by sharing the icon, subject or a capability tag.

`ENGINE_CATALOG`/`getEngineCatalog` and all legacy engine route selectors project only accepted `kind: 'engine'` routes. `searchEngines` includes subject metadata in searchable text, and instructor search still applies access checks before limiting results. Engine tooltip consumers use that filtered catalog. Generic module routes, navigation and dashboard contributions include all eligible kinds. Do not use `canRoleAccessEngineRoute` to authorize a generic application/laboratory; the host uses `canAccessModule` and ProtectedRoute for every kind.

### Migration from API 1

API 2 requires explicit kind, category and a navigation group on every sidebar contribution. All built-in manifests and the disabled discovery example are migrated together. API-1 manifests and invalid/absent classifications are quarantined with structured validation issues; there is no implicit engine default. To migrate an existing module, set `apiVersion: 2`, choose its kind and category independently of majors, and set each existing sidebar contribution's group explicitly. Existing built-in entries use `tools`; the disabled discovery example is an education application in `applications`. Module `version` remains its own semantic version, separate from the host contract version.

## Minimal future standalone application manifest

Example only; no new application is implemented. When an application is built, give `src/features/example-app/index.ts` a default React component export, then place this file at `src/modules/example-app/module.ts`. Keep it disabled until its own feature/access tests pass; a host can explicitly enable it through `enabledIds`. No central engine catalog, router or sidebar registration edit is needed.

```typescript
import type { ModuleManifest } from '../contracts';

export default {
  id: 'example-app',
  version: '1.0.0',
  apiVersion: 2,
  kind: 'application',
  category: 'productivity',
  title: { en: 'Example application', ar: 'تطبيق تجريبي' },
  defaultEnabled: false,
  access: { roles: ['student', 'instructor', 'admin', 'super_admin'] },
  routes: [{
    path: '/example-app',
    load: () => import('@/features/example-app'),
    navigation: { group: 'applications', iconId: 'box', order: 100 },
  }],
} satisfies ModuleManifest;
```

This example makes no academic-major restriction and requests no resource-scoped permissions. Set those fields explicitly when the application's requirements demand them; category and capabilities never grant access. Add an optional `dashboard` contribution independently of sidebar placement. The checked-in, disabled `discovery-example` is a runnable API-2 application example using the same contract.

## Discovery and selection
Vite import.meta.glob eagerly discovers metadata only at build time; page loaders remain dynamic imports. Manifests must be trusted, side-effect-free data declarations and must not perform runtime work or eagerly import page implementations.
createModuleRegistry accepts unknown input and returns accepted modules/routes plus structured issues. Selection accepts enabledIds (opt into default-disabled modules) and disabledIds (takes precedence). A host can recompose with a selection at runtime; no persistent settings UI or external package installer is implemented.
Adding source files requires a dev-server/build refresh. This is not runtime installation of untrusted external packages.

Malformed metadata, unsupported API versions, missing loaders, invalid roles/permissions, duplicate IDs and duplicate paths are quarantined. Conflicting modules are both rejected, independent of discovery order. Core routes (including parameter matches) are reserved. Missing/disabled/rejected dependencies and dependency cycles quarantine dependent modules transitively.
Metadata evaluation/import syntax errors remain build/development errors; page loading/render failures are isolated by a route-local error boundary. Retry creates a fresh lazy loader. Other routes and shell navigation survive.

## Authorization
Every module route uses the existing ProtectedRoute login gate and canAccessModule. Roles must be explicit; administrators do not bypass a module that excludes them.
majors restrict the roles named in majorRestrictedRoles (all declared roles by default). Existing engines restrict students to mathematics while instructors/admins retain their previous route access. Instructor sidebar discovery remains major-specific; search can expose permitted engines from other majors.
permissions can name course:read or course:manage. Missing trusted resource-scoped grants deny access. The current global host supplies no such grants, so these routes stay denied until a resource-aware integration is implemented. A manifest cannot self-grant enrollment or exceptional privileges.
Backend/RPC/RLS authorization is still mandatory. Navigation visibility and frontend policies are not a security boundary. Do not add service-role keys to frontend configuration.

## Compatibility and verification
Existing engine metadata remains available through config/majorEngineAccess as an engine-only projection of accepted manifests. Existing URLs, built-in labels/icons/sidebar ordering and role/major access remain covered by regression tests. The student dashboard consumes all eligible dashboard contributions; instructor engine search consumes only engines.

Run module registry/integration tests, all routing/navigation tests, architecture checks, typecheck and production build after adding a module. Test malformed metadata, dependency failure, duplicate route/ID, unauthorized direct navigation, delayed/rejected load and render failure. Add real engine tests through existing math ports if the module performs computation.

Classification coverage uses glob-discovered test metadata under `modules/__tests__/fixtures/*/module.ts` for mathematical/scientific engines, an application and a laboratory. These fixtures are excluded from production discovery. Tests exercise the actual router, grouped sidebar, dashboard contributions and engine-only tooltips, including custom categories, cross-kind dependencies, missing resource grants and loader retry across every kind. The production-glob disabled example continues to prove registration without host edits.

## Route layout (backward-compatible API 2 extension)

`routes[].layout` optionally accepts `standard` (default) or `fullscreen`.
For a future standalone application the example above may add `layout: 'fullscreen'`
beside `path`. The registry rejects unknown modes. The host chooses the mode from
an accepted enabled route only after the same role/major/permission eligibility
check; presentation never bypasses ProtectedRoute, backend authorization, providers
or lazy error isolation. Other modules retain standard AppShell without changes.

Applications with unsaved work register `useNavigationGuard` from shared/navigation.
The synchronous guard must retain existing local recovery before consenting to
leave. Wouter uses the shared guarded location hook for push/replace and browser
Back/Forward. Keep a beforeunload handler for cross-document navigation. See
`docs/phase2/FULLSCREEN.md` for history limitations and browser verification.
