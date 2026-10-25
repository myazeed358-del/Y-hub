import { Link } from "wouter";
/** Stable existing module destinations; access is checked again by each service/RLS. */
export function SectionActivityLinks(
  { sectionId, ar }: { sectionId: string; ar: boolean },
) {
  const query = `?section=${encodeURIComponent(sectionId)}`;
  return (
    <nav
      aria-label={ar ? "أنشطة الشعبة" : "Section activities"}
      className="flex flex-wrap gap-3"
    >
      <Link className="text-primary underline" href={`/y-attendance${query}`}>
        {ar ? "الحضور والغياب" : "Attendance"}
      </Link>
      <Link
        className="text-primary underline"
        href={`/online-lectures${query}`}
      >
        {ar ? "المحاضرات المباشرة" : "Online lectures"}
      </Link>
    </nav>
  );
}
/** A URL chooses an already-authorized section, never expands the server directory. */
export function authorizedSectionSelection(
  search: string,
  sections: readonly { id: string }[],
  current = "",
) {
  if (sections.some((s) => s.id === current)) return current;
  const requested = new URLSearchParams(search).get("section");
  return sections.find((s) => s.id === requested)?.id ?? "";
}
