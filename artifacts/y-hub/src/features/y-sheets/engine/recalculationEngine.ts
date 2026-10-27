import { WorkbookData } from '../types/workbook';
import { WorksheetData, cellCoordToKey } from '../types/sheet';
import { CellRange, CellValue } from '../types/cell';
import { FormulaParser, ASTNode } from './parser';
import { FormulaEvaluator } from './evaluator';
import { DependencyGraph } from './dependencyGraph';
import { expandRange } from './references';

/**
 * Extracts all precedent cell keys (e.g. "Sheet1!0,0") from an AST
 */
function extractDependenciesFromAST(
  node: ASTNode,
  currentSheetName: string
): string[] {
  const deps: string[] = [];

  const visit = (n: ASTNode): void => {
    if (n.type === 'CellRef') {
      const sheetName = n.sheetName || currentSheetName;
      deps.push(`${sheetName}!${n.row},${n.col}`);
    } else if (n.type === 'RangeRef') {
      const sheetName = n.sheetName || currentSheetName;
      const positions = expandRange(n.range);
      for (const pos of positions) {
        deps.push(`${sheetName}!${pos.row},${pos.col}`);
      }
    } else if (n.type === 'UnaryOp') {
      visit(n.argument);
    } else if (n.type === 'BinaryOp') {
      visit(n.left);
      visit(n.right);
    } else if (n.type === 'FunctionCall') {
      for (const arg of n.args) {
        visit(arg);
      }
    }
  };

  visit(node);
  return deps;
}

export class RecalculationEngine {
  private dependencyGraph = new DependencyGraph();
  private parsedASTs = new Map<string, ASTNode>(); // cellId -> AST

  /**
   * Builds the dependency graph for a workbook and evaluates all formula cells
   */
  public recalculateWorkbook(workbook: WorkbookData): WorkbookData {
    this.dependencyGraph.clear();
    this.parsedASTs.clear();

    // Work on a copy so the original workbook stays untouched.
    const updatedWorkbook: WorkbookData = {
      ...workbook,
      sheets: workbook.sheets.map((sheet) => ({
        ...sheet,
        cells: { ...sheet.cells },
      })),
    };

    const sheetMap = new Map<string, WorksheetData>();
    for (const sheet of updatedWorkbook.sheets) {
      sheetMap.set(sheet.name, sheet);
      sheetMap.set(sheet.id, sheet);
    }

    const allFormulaCells: string[] = [];

    // Step 1: Parse all formulas and build dependency graph
    for (const sheet of updatedWorkbook.sheets) {
      for (const [key, cell] of Object.entries(sheet.cells)) {
        if (!cell || !cell.raw) continue;
        const cellId = `${sheet.name}!${key}`;

        if (cell.raw.startsWith('=')) {
          allFormulaCells.push(cellId);
          try {
            const ast = FormulaParser.parse(cell.raw);
            this.parsedASTs.set(cellId, ast);
            const deps = extractDependenciesFromAST(ast, sheet.name);
            this.dependencyGraph.setDependencies(cellId, deps);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '#ERROR!';
            sheet.cells[key] = {
              ...cell,
              error: msg,
              computed: msg,
            };
          }
        } else {
          // Normal value cell
          let comp: CellValue = cell.raw;
          if (!isNaN(Number(cell.raw)) && cell.raw.trim() !== '') {
            comp = Number(cell.raw);
          } else if (cell.raw.toUpperCase() === 'TRUE') {
            comp = true;
          } else if (cell.raw.toUpperCase() === 'FALSE') {
            comp = false;
          }
          sheet.cells[key] = {
            ...cell,
            error: undefined,
            computed: comp,
          };
          this.dependencyGraph.removeCell(cellId);
        }
      }
    }

    // Step 2: Plan calculation order and detect cycles
    const plan = this.dependencyGraph.getRecalculationPlan(allFormulaCells);

    // Step 3: Mark circular references
    for (const circId of plan.circularCells) {
      const [sheetName, coordKey] = circId.split('!') as [string, string];
      const sheet = sheetMap.get(sheetName);
      if (sheet && sheet.cells[coordKey]) {
        sheet.cells[coordKey] = {
          ...sheet.cells[coordKey]!,
          error: '#CIRCULAR!',
          computed: '#CIRCULAR!',
        };
      }
    }

    // Step 4: Create cell and range resolvers for evaluation
    const resolveCell = (row: number, col: number, sheetName?: string): CellValue => {
      const targetSheet = sheetName ? sheetMap.get(sheetName) : updatedWorkbook.sheets[0];
      if (!targetSheet) return '#REF!';
      const key = cellCoordToKey(row, col);
      const cell = targetSheet.cells[key];
      if (!cell) return null;
      if (cell.error) return cell.error;
      return cell.computed ?? null;
    };

    const resolveRange = (range: CellRange, sheetName?: string): CellValue[][] => {
      const targetSheet = sheetName ? sheetMap.get(sheetName) : updatedWorkbook.sheets[0];
      if (!targetSheet) return [['#REF!']];

      const grid: CellValue[][] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        const rowVals: CellValue[] = [];
        for (let c = range.startCol; c <= range.endCol; c++) {
          rowVals.push(resolveCell(r, c, sheetName));
        }
        grid.push(rowVals);
      }
      return grid;
    };

    // Step 5: Evaluate formulas in topological order
    for (const cellId of plan.order) {
      const [sheetName, coordKey] = cellId.split('!') as [string, string];
      const sheet = sheetMap.get(sheetName);
      const ast = this.parsedASTs.get(cellId);
      if (!sheet || !ast) continue;

      const evaluator = new FormulaEvaluator({
        resolveCell,
        resolveRange,
        currentSheetName: sheet.name,
      });

      try {
        const result = evaluator.evaluate(ast);
        const cell = sheet.cells[coordKey] || { raw: '' };
        if (typeof result === 'string' && result.startsWith('#')) {
          sheet.cells[coordKey] = {
            ...cell,
            error: result,
            computed: result,
          };
        } else {
          sheet.cells[coordKey] = {
            ...cell,
            error: undefined,
            computed: result as CellValue,
          };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '#ERROR!';
        const cell = sheet.cells[coordKey] || { raw: '' };
        sheet.cells[coordKey] = {
          ...cell,
          error: errMsg,
          computed: errMsg,
        };
      }
    }

    return updatedWorkbook;
  }

  /**
   * Recalculates a single sheet within an optional workbook context
   */
  public recalculateSheet(sheet: WorksheetData, workbook?: WorkbookData): WorksheetData {
    const wb: WorkbookData = workbook || {
      id: 'default',
      name: 'Workbook',
      sheets: [sheet],
      activeSheetId: sheet.id,
      version: 1,
    };

    const updatedWb = this.recalculateWorkbook(wb);
    return updatedWb.sheets.find((s) => s.id === sheet.id) || sheet;
  }
}

export const recalculationEngine = new RecalculationEngine();
