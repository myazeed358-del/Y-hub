import { WorkbookData } from '../types/workbook';
import { WorksheetData, cellCoordToKey } from '../types/sheet';
import { recalculationEngine } from '../engine/recalculationEngine';

export function createDefaultWorkbook(): WorkbookData {
  // Sheet 1: Student Gradebook
  const gradebookCells: WorksheetData['cells'] = {
    // Title
    [cellCoordToKey(0, 0)]: {
      raw: 'University Computer Science 101 — Final Gradebook',
      style: { bold: true, fontSize: 16, textColor: '#107c41' },
    },
    // Headers (Row 2)
    [cellCoordToKey(2, 0)]: { raw: 'Student ID', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' } } },
    [cellCoordToKey(2, 1)]: { raw: 'Student Name', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' } } },
    [cellCoordToKey(2, 2)]: { raw: 'Homework', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'right' } },
    [cellCoordToKey(2, 3)]: { raw: 'Midterm', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'right' } },
    [cellCoordToKey(2, 4)]: { raw: 'Final Exam', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'right' } },
    [cellCoordToKey(2, 5)]: { raw: 'Total Score', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'right' } },
    [cellCoordToKey(2, 6)]: { raw: 'Average', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'right' } },
    [cellCoordToKey(2, 7)]: { raw: 'Status', style: { bold: true, backgroundColor: '#f3f4f6', borderBottom: { style: 'medium', color: '#374151' }, horizontalAlign: 'center' } },

    // Student 1: Alice Johnson
    [cellCoordToKey(3, 0)]: { raw: 'CS-1001' },
    [cellCoordToKey(3, 1)]: { raw: 'Alice Johnson' },
    [cellCoordToKey(3, 2)]: { raw: '92', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(3, 3)]: { raw: '88', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(3, 4)]: { raw: '95', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(3, 5)]: { raw: '=SUM(C4:E4)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(3, 6)]: { raw: '=ROUND(AVERAGE(C4:E4), 1)', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(3, 7)]: { raw: '=IF(G4>=60, "Pass", "Fail")', style: { horizontalAlign: 'center', bold: true, textColor: '#16a34a' } },

    // Student 2: Bob Smith
    [cellCoordToKey(4, 0)]: { raw: 'CS-1002' },
    [cellCoordToKey(4, 1)]: { raw: 'Bob Smith' },
    [cellCoordToKey(4, 2)]: { raw: '75', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(4, 3)]: { raw: '82', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(4, 4)]: { raw: '79', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(4, 5)]: { raw: '=SUM(C5:E5)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(4, 6)]: { raw: '=ROUND(AVERAGE(C5:E5), 1)', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(4, 7)]: { raw: '=IF(G5>=60, "Pass", "Fail")', style: { horizontalAlign: 'center', bold: true, textColor: '#16a34a' } },

    // Student 3: Charlie Brown
    [cellCoordToKey(5, 0)]: { raw: 'CS-1003' },
    [cellCoordToKey(5, 1)]: { raw: 'Charlie Brown' },
    [cellCoordToKey(5, 2)]: { raw: '55', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(5, 3)]: { raw: '50', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(5, 4)]: { raw: '58', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(5, 5)]: { raw: '=SUM(C6:E6)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(5, 6)]: { raw: '=ROUND(AVERAGE(C6:E6), 1)', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(5, 7)]: { raw: '=IF(G6>=60, "Pass", "Fail")', style: { horizontalAlign: 'center', bold: true, textColor: '#dc2626' } },

    // Student 4: Diana Prince
    [cellCoordToKey(6, 0)]: { raw: 'CS-1004' },
    [cellCoordToKey(6, 1)]: { raw: 'Diana Prince' },
    [cellCoordToKey(6, 2)]: { raw: '98', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(6, 3)]: { raw: '95', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(6, 4)]: { raw: '100', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(6, 5)]: { raw: '=SUM(C7:E7)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(6, 6)]: { raw: '=ROUND(AVERAGE(C7:E7), 1)', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(6, 7)]: { raw: '=IF(G7>=60, "Pass", "Fail")', style: { horizontalAlign: 'center', bold: true, textColor: '#16a34a' } },

    // Student 5: Evan Wright
    [cellCoordToKey(7, 0)]: { raw: 'CS-1005' },
    [cellCoordToKey(7, 1)]: { raw: 'Evan Wright' },
    [cellCoordToKey(7, 2)]: { raw: '84', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(7, 3)]: { raw: '78', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(7, 4)]: { raw: '81', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(7, 5)]: { raw: '=SUM(C8:E8)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 0 } },
    [cellCoordToKey(7, 6)]: { raw: '=ROUND(AVERAGE(C8:E8), 1)', style: { horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(7, 7)]: { raw: '=IF(G8>=60, "Pass", "Fail")', style: { horizontalAlign: 'center', bold: true, textColor: '#16a34a' } },

    // Summary Statistics (Row 9-12)
    [cellCoordToKey(9, 1)]: { raw: 'Class Average', style: { bold: true } },
    [cellCoordToKey(9, 2)]: { raw: '=ROUND(AVERAGE(C4:C8), 1)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(9, 3)]: { raw: '=ROUND(AVERAGE(D4:D8), 1)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },
    [cellCoordToKey(9, 4)]: { raw: '=ROUND(AVERAGE(E4:E8), 1)', style: { bold: true, horizontalAlign: 'right', numberFormat: 'number', decimalPlaces: 1 } },

    [cellCoordToKey(10, 1)]: { raw: 'Highest Score', style: { bold: true } },
    [cellCoordToKey(10, 2)]: { raw: '=MAX(C4:C8)', style: { bold: true, horizontalAlign: 'right' } },
    [cellCoordToKey(10, 3)]: { raw: '=MAX(D4:D8)', style: { bold: true, horizontalAlign: 'right' } },
    [cellCoordToKey(10, 4)]: { raw: '=MAX(E4:E8)', style: { bold: true, horizontalAlign: 'right' } },

    [cellCoordToKey(11, 1)]: { raw: 'Lowest Score', style: { bold: true } },
    [cellCoordToKey(11, 2)]: { raw: '=MIN(C4:C8)', style: { bold: true, horizontalAlign: 'right' } },
    [cellCoordToKey(11, 3)]: { raw: '=MIN(D4:D8)', style: { bold: true, horizontalAlign: 'right' } },
    [cellCoordToKey(11, 4)]: { raw: '=MIN(E4:E8)', style: { bold: true, horizontalAlign: 'right' } },

    [cellCoordToKey(12, 1)]: { raw: 'Total Enrolled', style: { bold: true } },
    [cellCoordToKey(12, 2)]: { raw: '=COUNTA(B4:B8)', style: { bold: true, horizontalAlign: 'right' } },
  };

  const sheet1: WorksheetData = {
    id: 'sheet-gradebook',
    name: 'Gradebook',
    rowCount: 50,
    colCount: 26,
    cells: gradebookCells,
    columnWidths: { 0: 110, 1: 160, 2: 100, 3: 100, 4: 100, 5: 110, 6: 100, 7: 90 },
    rowHeights: { 0: 36, 2: 28 },
    mergedCells: [
      { id: 'm1', startRow: 0, startCol: 0, endRow: 0, endCol: 7 },
    ],
    conditionalFormats: [
      {
        id: 'cf1',
        range: { startRow: 3, startCol: 6, endRow: 7, endCol: 6 },
        type: 'greaterThan',
        value1: 89,
        style: { backgroundColor: '#dcfce7', textColor: '#15803d', bold: true },
      },
      {
        id: 'cf2',
        range: { startRow: 3, startCol: 6, endRow: 7, endCol: 6 },
        type: 'lessThan',
        value1: 60,
        style: { backgroundColor: '#fee2e2', textColor: '#b91c1c', bold: true },
      },
    ],
    validations: {
      [cellCoordToKey(3, 7)]: { type: 'list', value1: 'Pass,Fail,Incomplete' },
      [cellCoordToKey(4, 7)]: { type: 'list', value1: 'Pass,Fail,Incomplete' },
      [cellCoordToKey(5, 7)]: { type: 'list', value1: 'Pass,Fail,Incomplete' },
      [cellCoordToKey(6, 7)]: { type: 'list', value1: 'Pass,Fail,Incomplete' },
      [cellCoordToKey(7, 7)]: { type: 'list', value1: 'Pass,Fail,Incomplete' },
    },
  };

  // Sheet 2: Project Budget
  const budgetCells: WorksheetData['cells'] = {
    [cellCoordToKey(0, 0)]: { raw: 'Student Research Lab Budget', style: { bold: true, fontSize: 16, textColor: '#2563eb' } },
    [cellCoordToKey(2, 0)]: { raw: 'Expense Item', style: { bold: true, backgroundColor: '#eff6ff' } },
    [cellCoordToKey(2, 1)]: { raw: 'Projected Budget', style: { bold: true, backgroundColor: '#eff6ff', horizontalAlign: 'right' } },
    [cellCoordToKey(2, 2)]: { raw: 'Actual Cost', style: { bold: true, backgroundColor: '#eff6ff', horizontalAlign: 'right' } },
    [cellCoordToKey(2, 3)]: { raw: 'Variance', style: { bold: true, backgroundColor: '#eff6ff', horizontalAlign: 'right' } },
    [cellCoordToKey(2, 4)]: { raw: 'Status', style: { bold: true, backgroundColor: '#eff6ff', horizontalAlign: 'center' } },

    [cellCoordToKey(3, 0)]: { raw: 'Cloud Server GPUs' },
    [cellCoordToKey(3, 1)]: { raw: '2400', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(3, 2)]: { raw: '2150.50', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(3, 3)]: { raw: '=B4-C4', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right', bold: true } },
    [cellCoordToKey(3, 4)]: { raw: '=IF(D4>=0, "Under Budget", "Over Budget")', style: { horizontalAlign: 'center' } },

    [cellCoordToKey(4, 0)]: { raw: 'Data Annotation' },
    [cellCoordToKey(4, 1)]: { raw: '800', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(4, 2)]: { raw: '920', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(4, 3)]: { raw: '=B5-C5', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right', bold: true } },
    [cellCoordToKey(4, 4)]: { raw: '=IF(D5>=0, "Under Budget", "Over Budget")', style: { horizontalAlign: 'center' } },

    [cellCoordToKey(5, 0)]: { raw: 'Conference Registration' },
    [cellCoordToKey(5, 1)]: { raw: '1200', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(5, 2)]: { raw: '1150', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(5, 3)]: { raw: '=B6-C6', style: { numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right', bold: true } },
    [cellCoordToKey(5, 4)]: { raw: '=IF(D6>=0, "Under Budget", "Over Budget")', style: { horizontalAlign: 'center' } },

    [cellCoordToKey(6, 0)]: { raw: 'Total', style: { bold: true } },
    [cellCoordToKey(6, 1)]: { raw: '=SUM(B4:B6)', style: { bold: true, numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(6, 2)]: { raw: '=SUM(C4:C6)', style: { bold: true, numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
    [cellCoordToKey(6, 3)]: { raw: '=B7-C7', style: { bold: true, numberFormat: 'currency', decimalPlaces: 2, horizontalAlign: 'right' } },
  };

  const sheet2: WorksheetData = {
    id: 'sheet-budget',
    name: 'Lab Budget',
    rowCount: 50,
    colCount: 26,
    cells: budgetCells,
    columnWidths: { 0: 220, 1: 140, 2: 140, 3: 130, 4: 130 },
    rowHeights: { 0: 36, 2: 28 },
    mergedCells: [{ id: 'm_b1', startRow: 0, startCol: 0, endRow: 0, endCol: 4 }],
    conditionalFormats: [
      {
        id: 'cf_var',
        range: { startRow: 3, startCol: 3, endRow: 6, endCol: 3 },
        type: 'lessThan',
        value1: 0,
        style: { textColor: '#dc2626' },
      },
    ],
    validations: {},
  };

  const rawWb: WorkbookData = {
    id: 'wb-default',
    name: 'University Workspace Workbook',
    sheets: [sheet1, sheet2],
    activeSheetId: sheet1.id,
    version: 1,
  };

  return recalculationEngine.recalculateWorkbook(rawWb);
}
