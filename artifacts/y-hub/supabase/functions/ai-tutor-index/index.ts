import { downloadPdf, serve } from "../_shared/tutor/runtime.ts";
import { indexSource } from "../_shared/tutor/indexing.ts";
import { extractPdf } from "../_shared/tutor/pdf.ts";
serve((request, ctx, token) =>
  indexSource(request, {
    ...ctx,
    project: ctx.env("SUPABASE_URL")!,
    download: (path) => downloadPdf(ctx, token, path),
    extract: extractPdf,
  })
);
