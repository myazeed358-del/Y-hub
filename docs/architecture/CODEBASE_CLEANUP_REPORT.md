# Codebase cleanup report

## Removed unused application scaffold

The application imports its active UI primitives from `@workspace/y-hub-ds`. Before deletion, all tracked TypeScript/JavaScript imports, exports and literal dynamic imports were parsed with TypeScript and resolved using each importing file's nearest tsconfig. No resolved import from outside this 58-file group targeted a candidate. Internal references were confined to the obsolete UI copy and its toast/mobile hooks.

Additional checks covered source text, tests, package exports, configuration and discovery patterns. The only application discovery glob is `modules/*/module.ts`; it cannot load these candidates. The private application has no package export for them. The active 404 route uses `features/not-found` through `pages/legacy/NotFound`, not the stale scaffold page. The design-system CSS explicitly scans its own components (`@source "./components"`), so its utility classes do not depend on the removed application copy. `components.json` remains a code-generation configuration, not runtime discovery; new UI primitives belong in the design-system package.

Deleted paths (relative to repository root):

- `artifacts/y-hub/src/components/ui/accordion.tsx`
- `artifacts/y-hub/src/components/ui/alert-dialog.tsx`
- `artifacts/y-hub/src/components/ui/alert.tsx`
- `artifacts/y-hub/src/components/ui/aspect-ratio.tsx`
- `artifacts/y-hub/src/components/ui/avatar.tsx`
- `artifacts/y-hub/src/components/ui/badge.tsx`
- `artifacts/y-hub/src/components/ui/breadcrumb.tsx`
- `artifacts/y-hub/src/components/ui/button-group.tsx`
- `artifacts/y-hub/src/components/ui/button.tsx`
- `artifacts/y-hub/src/components/ui/calendar.tsx`
- `artifacts/y-hub/src/components/ui/card.tsx`
- `artifacts/y-hub/src/components/ui/carousel.tsx`
- `artifacts/y-hub/src/components/ui/chart.tsx`
- `artifacts/y-hub/src/components/ui/checkbox.tsx`
- `artifacts/y-hub/src/components/ui/collapsible.tsx`
- `artifacts/y-hub/src/components/ui/command.tsx`
- `artifacts/y-hub/src/components/ui/context-menu.tsx`
- `artifacts/y-hub/src/components/ui/dialog.tsx`
- `artifacts/y-hub/src/components/ui/drawer.tsx`
- `artifacts/y-hub/src/components/ui/dropdown-menu.tsx`
- `artifacts/y-hub/src/components/ui/empty.tsx`
- `artifacts/y-hub/src/components/ui/field.tsx`
- `artifacts/y-hub/src/components/ui/form.tsx`
- `artifacts/y-hub/src/components/ui/hover-card.tsx`
- `artifacts/y-hub/src/components/ui/input-group.tsx`
- `artifacts/y-hub/src/components/ui/input-otp.tsx`
- `artifacts/y-hub/src/components/ui/input.tsx`
- `artifacts/y-hub/src/components/ui/item.tsx`
- `artifacts/y-hub/src/components/ui/kbd.tsx`
- `artifacts/y-hub/src/components/ui/label.tsx`
- `artifacts/y-hub/src/components/ui/menubar.tsx`
- `artifacts/y-hub/src/components/ui/navigation-menu.tsx`
- `artifacts/y-hub/src/components/ui/pagination.tsx`
- `artifacts/y-hub/src/components/ui/popover.tsx`
- `artifacts/y-hub/src/components/ui/progress.tsx`
- `artifacts/y-hub/src/components/ui/radio-group.tsx`
- `artifacts/y-hub/src/components/ui/resizable.tsx`
- `artifacts/y-hub/src/components/ui/scroll-area.tsx`
- `artifacts/y-hub/src/components/ui/select.tsx`
- `artifacts/y-hub/src/components/ui/separator.tsx`
- `artifacts/y-hub/src/components/ui/sheet.tsx`
- `artifacts/y-hub/src/components/ui/sidebar.tsx`
- `artifacts/y-hub/src/components/ui/skeleton.tsx`
- `artifacts/y-hub/src/components/ui/slider.tsx`
- `artifacts/y-hub/src/components/ui/sonner.tsx`
- `artifacts/y-hub/src/components/ui/spinner.tsx`
- `artifacts/y-hub/src/components/ui/switch.tsx`
- `artifacts/y-hub/src/components/ui/table.tsx`
- `artifacts/y-hub/src/components/ui/tabs.tsx`
- `artifacts/y-hub/src/components/ui/textarea.tsx`
- `artifacts/y-hub/src/components/ui/toast.tsx`
- `artifacts/y-hub/src/components/ui/toaster.tsx`
- `artifacts/y-hub/src/components/ui/toggle-group.tsx`
- `artifacts/y-hub/src/components/ui/toggle.tsx`
- `artifacts/y-hub/src/components/ui/tooltip.tsx`
- `artifacts/y-hub/src/hooks/use-toast.ts`
- `artifacts/y-hub/src/hooks/use-mobile.tsx`
- `artifacts/y-hub/src/pages/not-found.tsx`

The 55 `components/ui` files were unused parallel implementations. The two hooks only served that copy. `pages/not-found.tsx` was an unreferenced template with scaffold instructions.

## Dependency cleanup

Removed app-only direct dependencies after parsing all remaining application source/tests/config imports and inspecting CSS, type packages and peer requirements. The design-system and sandbox dependency manifests remain unchanged. Packages used by those workspaces remain in the lockfile as required.

Removed 39 app-level declarations: `@hookform/resolvers`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `class-variance-authority`, `cmdk`, `date-fns`, `embla-carousel-react`, `framer-motion`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-icons`, `react-resizable-panels`, `vaul`.

Updated with pnpm 9.12.0 `--filter y-hub remove`; frozen offline workspace installation passed. `react-icons` was removed from the package graph; shared UI packages remain where used. pnpm also pruned an unused tsx catalog resolution and marked its remaining optional dependency accordingly; no dependency versions were upgraded. The initial package-manager invocation could not write its default home cache; rerunning with the existing workspace store succeeded.

## Retained intentionally

- Active design-system/sandbox UI components, `ThemeToggle`, `ScientificBackdrop`, layout facades and themes/colors.
- All mathematical implementations and public compatibility exports, including APIs without a proven obsolete contract.
- Legacy route/page facades referenced by routing/tests or retained for compatibility.
- Applied Supabase migrations, policies, student-number schema, auth configuration and all valid tests.
- Plotly (peer of react-plotly.js), jsdom (Vitest environment), type packages and CSS/tooling dependencies. No package was removed solely because it lacked a JavaScript import.

## Verification

Passed after this deletion batch: frozen offline workspace install; all three artifact package typechecks and root tsc build; 182 Vitest files / 1622 tests; 29 Python tests; eight seeded boundary-check tests; all three architecture audits; production Vite build (43.18 seconds); git diff --check. No tests were deleted. No production data operations are part of cleanup. Source scan decreased from 541 to 483 production files. No design-system source, math implementation, Supabase migration or source configuration changed.
