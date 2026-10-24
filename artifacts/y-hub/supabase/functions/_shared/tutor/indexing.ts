import {
  access,
  type Context,
  embed,
  input,
  lease,
  TutorError,
  uuid,
} from "./core.ts";
export interface Page {
  page: number;
  text: string;
  unitId?: string;
}
export function chunks(pages: Page[]) {
  const result: {
    text: string;
    page: number | null;
    unitId?: string;
    embedding?: number[];
  }[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n").trim();
    for (let start = 0; start < text.length; start += 1400) {
      const part = text.slice(start, start + 1600).trim();
      if (part) {
        result.push({
          text: part,
          page: page.page || null,
          unitId: page.unitId,
        });
      }
      if (result.length > 256) {
        throw new TutorError(413, "Document exceeds index limit");
      }
    }
  }
  return result;
}
export function storagePath(url: string, project: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TutorError(422, "Only approved stored PDFs are supported");
  }
  const prefix = "/storage/v1/object/public/materials/";
  if (
    parsed.origin !== new URL(project).origin ||
    !parsed.pathname.startsWith(prefix) || parsed.search || parsed.hash
  ) {
    throw new TutorError(
      422,
      "Only this project’s materials bucket is supported",
    );
  }
  const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
  if (
    !path || path.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\x00-\x1f\\]/.test(path)
  ) throw new TutorError(422, "Invalid storage path");
  return path;
}
export interface IndexContext extends Context {
  project: string;
  download: (path: string) => Promise<Uint8Array>;
  extract: (bytes: Uint8Array) => Promise<Page[]>;
}
export async function indexSource(req: Request, ctx: IndexContext) {
  const body = await input(req);
  if (
    Object.keys(body).some((k) => !["sourceId"].includes(k)) ||
    !uuid(body.sourceId)
  ) throw new TutorError(400, "Source ID required");
  const { data: source, error } = await ctx.db.from("ai_tutor_sources").select(
    "*",
  ).eq("id", body.sourceId).maybeSingle();
  if (error || !source) throw new TutorError(403, "Source unavailable");
  await access(ctx, source.course_id, true);
  return lease(ctx, source.course_id, true, async () => {
    let pages: Page[], path: string | null = null;
    if (source.kind === "pdf") {
      const { data: material, error } = await ctx.db.from("course_materials")
        .select("url").eq("id", source.material_id).eq(
          "course_id",
          source.course_id,
        ).single();
      if (error || !material) throw new TutorError(403, "Material unavailable");
      path = storagePath(material.url, ctx.project);
      pages = await ctx.extract(await ctx.download(path));
    } else {
      const { data, error } = await ctx.db.rpc("read_course_syllabus", {
        p_course_id: source.course_id,
      });
      if (error || !data) throw new TutorError(403, "Syllabus unavailable");
      pages = data.units.map((
        u: { id: string; title: string; sections: { title: string }[] },
      ) => ({
        page: 0,
        unitId: u.id,
        text: [u.title, ...u.sections.map((s) => s.title)].join("\n"),
      }));
    }
    const content = chunks(pages);
    let model: string | null = null;
    // Bounded embedding batches; no whole book is sent on each chat request.
    for (let offset = 0; offset < content.length; offset += 16) {
      const result = await embed(
        ctx,
        content.slice(offset, offset + 16).map((c) => c.text),
      );
      model = result.model;
      result.vectors?.forEach((v, i) => {
        content[offset + i].embedding = v;
      });
    }
    await access(ctx, source.course_id, true);
    const saved = await ctx.admin.rpc("publish_ai_tutor_source", {
      p_actor: ctx.actor,
      p_source: source.id,
      p_revision: source.revision,
      p_chunks: content,
      p_model: model,
      p_path: path,
    });
    if (saved.error) {
      throw new TutorError(
        saved.error.code === "PT409" ? 409 : saved.error.code === "42501" ? 403 : 503,
        "Index changed or could not be published",
      );
    }
    return {
      status: content.length ? "ready" : "unreadable",
      chunks: content.length,
    };
  });
}
