import { useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import type { TutorCitation } from "../ai-chat/aiTutorClient";
export function SourceEvidence({ sources }: { sources: TutorCitation[] }) {
  const [error, setError] = useState("");
  async function open(c: TutorCitation) {
    setError("");
    // Re-read the authorized source before each opening; never trust model URLs.
    const source = await supabase.from("ai_tutor_sources").select(
      "material_id,revision,course_id",
    ).eq("id", c.source_id).maybeSingle();
    if (source.error || !source.data || source.data.revision !== c.revision) {
      setError("Source unavailable / المصدر غير متاح");
      return;
    }
    if (!source.data.material_id) {
      window.location.assign(`/course/${source.data.course_id}/view`);
      return;
    }
    const material = await supabase.from("course_materials").select("url").eq(
      "id",
      source.data.material_id,
    ).single();
    try {
      if (material.error || !material.data) throw new Error();
      const url = new URL(material.data.url),
        base = new URL(import.meta.env.VITE_SUPABASE_URL);
      const prefix = "/storage/v1/object/public/materials/";
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) {
        throw new Error();
      }
      const path = decodeURIComponent(url.pathname.slice(prefix.length));
      const file = await supabase.storage.from("materials").download(path);
      if (file.error || !file.data) throw new Error();
      const current = await supabase.from("ai_tutor_sources").select(
        "material_id,revision,course_id",
      ).eq("id", c.source_id).maybeSingle();
      if (current.error || current.data?.revision !== c.revision) {
        throw new Error();
      }
      const link = URL.createObjectURL(file.data);
      const a = document.createElement("a");
      a.href = link;
      a.download = c.title + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(link), 1000);
    } catch {
      setError("Cannot open source / تعذر فتح المصدر");
    }
  }
  return (
    <div className="space-y-2 w-full">
      {sources.map((c) => (
        <details className="rounded border p-2 text-xs" key={c.id}>
          <summary>
            {c.title}
            {c.page ? ` — p. ${c.page} / ص. ${c.page}` : ""}
          </summary>
          <blockquote dir="auto" className="whitespace-pre-wrap my-2">
            {c.text}
          </blockquote>
          <button
            className="text-primary underline"
            onClick={() =>
              void open(c)}
          >
            View source / عرض المصدر
          </button>
        </details>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
