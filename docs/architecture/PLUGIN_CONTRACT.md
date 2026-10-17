# Y-Hub module contract (API 1)

## Add a module
Create src/modules/<unique-kebab-id>/module.ts exporting a default object satisfying ModuleManifest (import its type from ../contracts). No central registry, AppRoutes, engine catalog, sidebar array or translation-table edit is needed.

Required fields: id, version (major.minor.patch), apiVersion: 1, title {ar,en}, access.roles, and nonempty routes. Each route has a static lowercase absolute path and load: () => import('@/features/my-feature'). Expose the component as the feature's default public export.
Optional metadata: description, category, keywords, capabilities, dependencies (module IDs), defaultEnabled, route.order, route.navigation and route.dashboard. Dashboard contributions provide their own localized title, iconId and order, sharing the same access checks.
Navigation requires iconId and order; title can be supplied locally, or use an existing UiKey labelKey for backward-compatible translations. New localized titles require no global translation edits.

See src/modules/discovery-example/module.ts and ExamplePage.tsx for a disabled working example. Integration tests enable it through createModuleRegistry(discoveredModules, {enabledIds: ['discovery-example']}) and render the real AppRoutes and SidebarNavigation. The fixture is not a new user-facing product.

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
Existing engine metadata remains available through config/majorEngineAccess as a projection of accepted manifests. Existing URLs, built-in labels/icons/sidebar ordering and role/major access remain covered by regression tests. The student dashboard and instructor search should consume the same accepted contributions.

Run module registry/integration tests, all routing/navigation tests, architecture checks, typecheck and production build after adding a module. Test malformed metadata, dependency failure, duplicate route/ID, unauthorized direct navigation, delayed/rejected load and render failure. Add real engine tests through existing math ports if the module performs computation.
