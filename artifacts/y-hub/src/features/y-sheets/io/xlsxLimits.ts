import { Unzip, UnzipInflate } from "fflate";
import { WORKBOOK_LIMITS } from "./workbookValidation";
export const EXCEL_LIMITS = {
  inputBytes: WORKBOOK_LIMITS.bytes,
  expandedBytes: 20 * 1024 * 1024,
  entries: 1024,
  timeoutMs: 15000,
} as const;
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
/** Bound both advertised and actual inflation, before the workbook parser sees ZIP data. */
export function validateExcelContainer(bytes: Uint8Array): void {
  if (!bytes.length || bytes.length > EXCEL_LIMITS.inputBytes)
    throw new Error("Excel file is empty or exceeds 5 MiB.");
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (ole.every((b, i) => bytes[i] === b)) return; // Legacy XLS: parser still runs in a time-limited worker.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50)
    throw new Error("Invalid XLS/XLSX file signature.");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Invalid ZIP directory.");
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== count ||
    !count ||
    count > EXCEL_LIMITS.entries ||
    start + size !== end
  )
    throw new Error("Unsupported ZIP layout or too many entries.");
  const entries = new Map<string, { size: number; crc: number }>();
  let pos = start,
    total = 0;
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error("Corrupt ZIP entry.");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      compressed = view.getUint32(pos + 20, true),
      expanded = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      local = view.getUint32(pos + 42, true);
    if (
      pos + 46 + nameLength + extra + comment > end ||
      local + 30 > start ||
      view.getUint32(local, true) !== 0x04034b50 ||
      flags & 1 ||
      ![0, 8].includes(method)
    )
      throw new Error("Encrypted or unsupported ZIP entry.");
    const name = decoder.decode(
      bytes.subarray(pos + 46, pos + 46 + nameLength),
    );
    const localNameLength = view.getUint16(local + 26, true),
      localExtra = view.getUint16(local + 28, true);
    if (
      local + 30 + localNameLength + localExtra + compressed > start ||
      decoder.decode(
        bytes.subarray(local + 30, local + 30 + localNameLength),
      ) !== name ||
      entries.has(name) ||
      name.split("/").includes("..") ||
      name.startsWith("/")
    )
      throw new Error("Unsafe ZIP entry.");
    total += expanded;
    if (total > EXCEL_LIMITS.expandedBytes)
      throw new Error("Expanded Excel data exceeds 20 MiB.");
    entries.set(name, { size: expanded, crc: view.getUint32(pos + 16, true) });
    pos += 46 + nameLength + extra + comment;
  }
  if (
    pos !== end ||
    !entries.has("[Content_Types].xml") ||
    !entries.has("xl/workbook.xml")
  )
    throw new Error("Not an XLSX workbook.");
  let actual = 0,
    completed = 0,
    failure: Error | undefined;
  const seen = new Set<string>();
  const unzip = new Unzip((file) => {
    const expected = entries.get(file.name);
    if (!expected || seen.has(file.name)) {
      failure = new Error("Unexpected ZIP entry.");
      file.terminate();
      return;
    }
    seen.add(file.name);
    let length = 0,
      crc = 0xffffffff,
      tail = "";
    const xml = file.name.endsWith(".xml") || file.name.endsWith(".rels");
    file.ondata = (err, chunk, final) => {
      if (err) {
        failure = err;
        return;
      }
      actual += chunk.length;
      length += chunk.length;
      if (actual > EXCEL_LIMITS.expandedBytes || length > expected.size) {
        failure = new Error("Excel expansion limit exceeded.");
        file.terminate();
        return;
      }
      for (const byte of chunk)
        crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
      if (xml) {
        const text = tail + decoder.decode(chunk).replace(/\0/g, "");
        if (/<!\s*(DOCTYPE|ENTITY)/i.test(text)) {
          failure = new Error("XML entities are not supported.");
          file.terminate();
          return;
        }
        tail = text.slice(-40);
      }
      if (final) {
        if (
          length !== expected.size ||
          (crc ^ 0xffffffff) >>> 0 !== expected.crc
        )
          failure = new Error("Excel ZIP integrity check failed.");
        completed++;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small compressed chunks prevent a single callback from allocating an unbounded expansion.
  for (let offset = 0; offset < bytes.length; offset += 256) {
    unzip.push(
      bytes.subarray(offset, offset + 256),
      offset + 256 >= bytes.length,
    );
    if (failure) throw failure;
  }
  if (completed !== count) throw new Error("Incomplete Excel archive.");
}
