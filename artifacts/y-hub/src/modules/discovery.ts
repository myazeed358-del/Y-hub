import { createModuleRegistry } from './registry';

// Manifests are trusted, side-effect-free metadata. Entry points remain lazy.
// Adding a conforming */module.ts is the only registration step.
export const discoveredModules = import.meta.glob('./*/module.ts', { eager: true, import: 'default' });
export const moduleRegistry = createModuleRegistry(discoveredModules);
for (const issue of moduleRegistry.issues) {
  console.error('[Y-Hub modules]', issue.source, issue.code, issue.message);
}
