import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  WorkbookProvider,
  useWorkbook,
  type WorkbookContextType,
} from "../state/workbookContext";
import { CellEditor } from "../components/Grid/CellEditor";
import { FormulaBar } from "../components/FormulaBar/FormulaBar";
import { createDefaultWorkbook } from "../state/defaultWorkbook";
afterEach(cleanup);
it("journals keystrokes before the cell is committed and cancels explicitly", () => {
  const draft = vi.fn();
  render(
    <WorkbookProvider onDraftChange={draft}>
      <CellEditor
        row={0}
        col={0}
        top={0}
        left={0}
        width={100}
        height={20}
        initialValue=""
      />
    </WorkbookProvider>,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "last keystroke" },
  });
  expect(draft).toHaveBeenLastCalledWith(
    expect.objectContaining({ row: 0, col: 0, raw: "last keystroke" }),
  );
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(draft).toHaveBeenLastCalledWith(null);
});
it("journals formula-bar edits and allows cancellation", () => {
  const draft = vi.fn();
  render(
    <WorkbookProvider onDraftChange={draft}>
      <FormulaBar />
    </WorkbookProvider>,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "=SUM(A1:A2)" },
  });
  expect(draft).toHaveBeenLastCalledWith(
    expect.objectContaining({ raw: "=SUM(A1:A2)" }),
  );
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(draft).toHaveBeenLastCalledWith(null);
});
it("rechecks revoked edit permission for undo and redo", () => {
  let context: WorkbookContextType;
  const Probe = () => {
    context = useWorkbook();
    return null;
  };
  const wb = createDefaultWorkbook();
  const { rerender } = render(
    <WorkbookProvider canEdit initialWorkbook={wb}>
      <Probe />
    </WorkbookProvider>,
  );
  act(() =>
    context.dispatch({
      type: "SET_CELL_RAW",
      payload: { sheetId: wb.activeSheetId, row: 0, col: 0, raw: "changed" },
    }),
  );
  rerender(
    <WorkbookProvider canEdit={false} initialWorkbook={wb}>
      <Probe />
    </WorkbookProvider>,
  );
  act(() => context.undo());
  expect(context!.activeSheet.cells["0,0"]!.raw).toBe("changed");
});
