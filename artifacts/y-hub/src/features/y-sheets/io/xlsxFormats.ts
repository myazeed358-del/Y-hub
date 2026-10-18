import type { CellStyle } from "../types/cell";
/** Supported scalar formats; JSON is the lossless format for all Y-Sheets styles. */
export function toExcelFormat(style?: CellStyle): string {
  const decimals = style?.decimalPlaces ?? 2;
  const number = "0" + (decimals ? "." + "0".repeat(decimals) : "");
  switch (style?.numberFormat) {
    case "number":
      return number;
    case "currency":
      return "$#,##" + number;
    case "percentage":
      return number + "%";
    case "text":
      return "@";
    default:
      return "General";
  }
}
export function fromExcelFormat(
  format?: string | number,
): CellStyle | undefined {
  if (typeof format !== "string" || format === "General") return undefined;
  if (format === "@") return { numberFormat: "text" };
  const decimalPlaces = format.match(/\.(0+)/)?.[1]?.length ?? 0;
  if (decimalPlaces > 20) return undefined;
  if (/^0(?:\.0+)?%$/.test(format))
    return { numberFormat: "percentage", decimalPlaces };
  if (/^\$#,##0(?:\.0+)?$/.test(format))
    return { numberFormat: "currency", decimalPlaces };
  if (/^0(?:\.0+)?$/.test(format))
    return { numberFormat: "number", decimalPlaces };
  return undefined;
}
