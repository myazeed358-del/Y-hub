import { decodeWorkbook, encodeWorkbook } from "./xlsxCodec";
import type { WorkbookData } from "../types/workbook";
self.onmessage = (
  event: MessageEvent<
    | { kind: "import"; data: ArrayBuffer }
    | { kind: "export"; workbook: WorkbookData }
  >,
) => {
  try {
    const result =
      event.data.kind === "import"
        ? decodeWorkbook(event.data.data)
        : encodeWorkbook(event.data.workbook);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error ? error.message : "Excel conversion failed.",
    });
  }
};
