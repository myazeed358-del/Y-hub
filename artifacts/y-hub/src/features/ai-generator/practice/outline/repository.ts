import { supabase } from "@/utils/supabaseClient";
import { PracticeSourceError } from "../sourcesRepository";
import {
  outlineSchema,
  outlineSectionSchema,
  type OutlineSection,
} from "./contracts";
function check(error: { code?: string } | null) {
  if (error)
    throw new PracticeSourceError(
      ["42501", "PGRST301", "PGRST303"].includes(error.code ?? "")
        ? "denied"
        : error.code === "PT409"
          ? "conflict"
          : "unavailable",
    );
}
export const outlineRepository = {
  async read(sourceId: string, signal: AbortSignal) {
    const { data, error } = await supabase
      .rpc("get_ai_practice_outline", { p_source: sourceId })
      .abortSignal(signal);
    check(error);
    const result = outlineSchema.parse(data);
    if (result.sourceId !== sourceId)
      throw new PracticeSourceError("unavailable");
    return result;
  },
  async save(
    sourceId: string,
    sourceRevision: string,
    revision: number,
    sections: OutlineSection[],
  ) {
    const parsed = outlineSectionSchema.array().max(50).parse(sections);
    const { data, error } = await supabase.rpc("set_ai_practice_outline", {
      p_source: sourceId,
      p_source_revision: sourceRevision,
      p_revision: revision,
      p_sections: parsed,
    });
    check(error);
    if (!Number.isInteger(data) || data < 1)
      throw new PracticeSourceError("unavailable");
    return data as number;
  },
};
