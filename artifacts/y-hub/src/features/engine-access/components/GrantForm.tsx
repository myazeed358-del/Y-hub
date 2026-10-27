import { useRef, useState } from "react";
import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { grantWorkflows, type StudentMatch } from "../workflowRepository";
export function GrantForm(
  { student, engines, title, ar, onSaved }: {
    student: StudentMatch;
    engines: string[];
    title: (id: string) => string;
    ar: boolean;
    onSaved: () => void;
  },
) {
  const [chosen, setChosen] = useState<string[]>([]),
    [expires, setExpires] = useState(""),
    [limited, setLimited] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef(false);
  return (
    <form
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError(false);
        try {
          await grantWorkflows.grant(
            student.course_id,
            student.student_id,
            chosen,
            limited ? new Date(expires).toISOString() : null,
          );
          setChosen([]);
          onSaved();
        } catch {
          setError(true);
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || !student.active_enrollment}>
        <legend>
          {ar ? "المحركات المسموح لك بمنحها" : "Engines you may grant"}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {engines.map((id) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chosen.includes(id)}
                onChange={(e) =>
                  setChosen(
                    e.target.checked
                      ? [...chosen, id]
                      : chosen.filter((v) =>
                        v !== id
                      ),
                  )}
              />
              {title(id)}
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={limited}
            onChange={(e) => setLimited(e.target.checked)}
          />
          {ar ? "تحديد تاريخ انتهاء" : "Set an expiry date"}
        </label>
        {limited && (
          <label>
            {ar ? "انتهاء الصلاحية" : "Expires"}
            <input
              className="w-full rounded border border-border bg-background p-2"
              required
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </label>
        )}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "دون تاريخ محدد تستمر المنحة طوال التسجيل الفعال. التاريخ المحدد لا يتجاوز 366 يومًا. الانسحاب أو تغيير الدكتور يسحبها. المنح النشطة الموجودة لا تستبدل عند إعادة الطلب."
          : "Without an expiry, access lasts for active enrollment. A dated grant may last up to 366 days. Withdrawal or reassignment revokes it. Existing active grants are preserved on retry."}
      </p>
      {!student.active_enrollment && (
        <p>
          {ar
            ? "هذا سجل سابق؛ يلزم تسجيل فعال لمنح صلاحية جديدة."
            : "Historical relationship: active enrollment is required for new grants."}
        </p>
      )}
      {error && (
        <p role="alert">
          {ar
            ? "لم تتأكد المنح؛ احتفظنا باختياراتك. أعد التحقق من الصلاحيات قبل المحاولة."
            : "Grants not confirmed; your choices are preserved. Recheck permissions before retrying."}
        </p>
      )}
      <Button
        disabled={busy || !student.active_enrollment || !chosen.length ||
          chosen.length > 20 || (limited && !expires)}
      >
        {ar ? "منح المحركات المختارة" : "Grant selected engines"}
      </Button>
    </form>
  );
}
