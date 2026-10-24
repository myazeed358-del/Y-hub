import { extractPdf } from "./pdf.ts";
import { chunks } from "./indexing.ts";
Deno.test("extracts real PDF text and physical page provenance", async () => {
  const bytes = await Deno.readFile(
    new URL(
      "../../../../src/features/ai-generator/document-analysis/__fixtures__/two-pages.pdf",
      import.meta.url,
    ),
  );
  const pages = await extractPdf(bytes);
  if (
    pages.length !== 2 || !pages[0].text.trim() || pages[0].page !== 1 ||
    pages[1].page !== 2
  ) throw new Error("Page extraction failed");
  const index = chunks(pages);
  if (!index.length || index.some((c) => !c.page)) {
    throw new Error("Missing provenance");
  }
});
Deno.test("malformed PDF fails rather than fabricating evidence", async () => {
  let failed = false;
  try {
    await extractPdf(new TextEncoder().encode("%PDF-invalid"));
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("Invalid PDF accepted");
});
Deno.test("size limit is enforced before parsing", async () => {
  let failed = false;
  try {
    await extractPdf(new Uint8Array(5 * 1024 * 1024 + 1));
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("Oversize accepted");
});

Deno.test("valid blank PDF produces no invented text or OCR", async () => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = pdf.length;
  pdf += "xref\n0 5\n0000000000 65535 f \n" +
    offsets.slice(1).map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("");
  pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const pages = await extractPdf(new TextEncoder().encode(pdf));
  if (pages.length !== 1 || chunks(pages).length) {
    throw new Error("Blank PDF fabricated text");
  }
});
