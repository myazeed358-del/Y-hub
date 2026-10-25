import { useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { academicLectures } from "@/shared/academic/lectures";
export function LectureScheduler(
  { course, ar, busy, mutate }: {
    course: string;
    ar: boolean;
    busy: boolean;
    mutate: (fn: () => Promise<unknown>) => Promise<void>;
  },
) {
  const [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const field = "w-full rounded-md border border-border bg-background p-2";
  return (
    <form
      className="space-y-3 bg-card border border-border rounded-xl p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void mutate(() =>
          academicLectures.schedule(
            course,
            title,
            new Date(start).toISOString(),
            new Date(end).toISOString(),
          )
        );
      }}
    >
      <h2>{ar ? "جدولة محاضرة للشعبة" : "Schedule a section lecture"}</h2>
      <label>
        {ar ? "العنوان" : "Title"}
        <input
          required
          maxLength={200}
          className={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {ar ? "البداية" : "Start"}
        <input
          required
          type="datetime-local"
          className={field}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        {ar ? "النهاية" : "End"}
        <input
          required
          type="datetime-local"
          min={start || undefined}
          className={field}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <Button disabled={busy}>{ar ? "جدولة" : "Schedule"}</Button>
    </form>
  );
}
