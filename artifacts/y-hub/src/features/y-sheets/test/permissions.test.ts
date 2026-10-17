import { describe, expect, it } from 'vitest';
import { canPerformWorkbookAction } from '../state/workbookPermissions';
import type { WorkbookAction } from '../state/workbookActions';
import type { HostPermissions } from '../integration/hostContract';

const action = (type: WorkbookAction['type']): WorkbookAction =>
  ({ type } as WorkbookAction);

const full: HostPermissions = {
  canEdit: true,
  canExport: true,
  canCreateSheet: true,
  canDeleteSheet: true,
  canFormat: true,
};

describe('Y-Sheets permissions', () => {
  it('allows navigation in read-only mode', () => {
    expect(canPerformWorkbookAction(
      action('SET_ACTIVE_SHEET'),
      { canEdit: false },
    )).toBe(true);
  });

  it.each([
    'SET_CELL_RAW',
    'SET_CELLS_BATCH',
    'SET_WORKBOOK',
    'SET_WORKBOOK_NAME',
    'ADD_SHEET',
    'DELETE_SHEET',
    'FORMAT_CELLS',
    'SORT_RANGE',
    'INSERT_ROW',
    'DELETE_ROW',
    'INSERT_COL',
    'DELETE_COL',
  ] as WorkbookAction['type'][])(
    'blocks %s in read-only mode',
    type => {
      expect(canPerformWorkbookAction(
        action(type),
        { ...full, canEdit: false },
      )).toBe(false);
    },
  );

  it('blocks adding sheets without permission', () => {
    expect(canPerformWorkbookAction(
      action('ADD_SHEET'),
      { ...full, canCreateSheet: false },
    )).toBe(false);
  });

  it('blocks deleting sheets without permission', () => {
    expect(canPerformWorkbookAction(
      action('DELETE_SHEET'),
      { ...full, canDeleteSheet: false },
    )).toBe(false);
  });

  it('blocks formatting without permission', () => {
    expect(canPerformWorkbookAction(
      action('FORMAT_CELLS'),
      { ...full, canFormat: false },
    )).toBe(false);
  });

  it('allows editing with full permission', () => {
    expect(canPerformWorkbookAction(
      action('SET_CELL_RAW'),
      full,
    )).toBe(true);
  });
});
