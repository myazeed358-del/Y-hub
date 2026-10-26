import type { WorkbookAction } from './workbookActions';
import type { HostPermissions } from '../integration/hostContract';

export function canPerformWorkbookAction(
  action: WorkbookAction,
  permissions: HostPermissions,
): boolean {
  // Read-only users can still switch between sheets.
  if (action.type === 'SET_ACTIVE_SHEET') return true;

  if (permissions.canEdit !== true) return false;

  switch (action.type) {
    case 'ADD_SHEET':
      return permissions.canCreateSheet === true;

    case 'DELETE_SHEET':
      return permissions.canDeleteSheet === true;

    case 'FORMAT_CELLS':
    case 'ADD_CONDITIONAL_FORMAT':
    case 'REMOVE_CONDITIONAL_FORMAT':
    case 'MERGE_CELLS':
    case 'UNMERGE_CELLS':
    case 'SET_COL_WIDTH':
    case 'SET_ROW_HEIGHT':
      return permissions.canFormat === true;

    default:
      return true;
  }
}
