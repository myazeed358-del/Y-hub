import { getDocumentProxy } from "npm:unpdf@1.4.0";
import { TutorError } from "./core.ts";
import type { Page } from "./indexing.ts";
/** Serverless PDF.js text extraction: no rendering, URLs, JavaScript, OCR or attachments. */
export async function extractPdf(bytes: Uint8Array): Promise<Page[]> {
  if (bytes.length > 5 * 1024 * 1024) {
    throw new TutorError(413, "PDF too large");
  }
  const doc = await getDocumentProxy(bytes, {
    isEvalSupported: false,
    useSystemFonts: false,
  });
  try {
    if (doc.numPages > 300) throw new TutorError(413, "PDF exceeds 300 pages");
    const pages: Page[] = [];
    let size = 0;
    for (let page = 1; page <= doc.numPages; page++) {
      const sheet = await doc.getPage(page);
      const text = await sheet.getTextContent();
      const content = text.items.map((item) =>
        "str" in item
          ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
          : ""
      ).join("");
      size += content.length;
      if (size > 350000) throw new TutorError(413, "Extracted PDF too large");
      pages.push({ page, text: content });
      sheet.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
