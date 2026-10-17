export type {
  ModuleManifest, ModuleRole, ModuleAccessPolicy, ModuleAccessContext, ModulePermission,
  ModuleRouteDefinition, ModuleIcon, LocalizedText,
} from './contracts';
export type { ModuleRegistry, RegisteredModuleRoute, ModuleIssue, ModuleSelection } from './registry';
export { createModuleRegistry } from './registry';
export { canAccessModule } from './access';
export { moduleRegistry } from './discovery';
export { getModuleNavigation } from './navigation';
