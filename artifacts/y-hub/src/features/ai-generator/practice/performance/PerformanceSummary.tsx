import { useLanguage } from "@/i18n/LanguageContext";
import { performanceCopy } from "./copy";
import type { PerformanceSummary as Summary } from "./repository";
export function PerformanceSummary({ summary }: { summary: Summary }) {
  const { language } = useLanguage(),
    t = performanceCopy[language];
  const percentage = (n: number) =>
    `${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(n)}%`;
  return (
    <div className="space-y-2 min-w-0">
      <p>
        {t.score}:{" "}
        <bdi dir="ltr">
          {summary.score === null ? "—" : percentage(summary.score)}
        </bdi>
      </p>
      {summary.score === null ? (
        <p>{t.empty}</p>
      ) : (
        summary.coverage < 100 && <p>{t.partial}</p>
      )}
      <p>
        {t.coverage}: <bdi dir="ltr">{percentage(summary.coverage)}</bdi>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["practice", "exam"] as const).map((mode) => (
          <section
            key={mode}
            aria-label={t[mode]}
            className="rounded border p-2 min-w-0 break-words"
          >
            <h5 className="font-medium">{t[mode]}</h5>
            <p>
              {t.earned}:{" "}
              <bdi dir="ltr">
                {summary[mode].earned}/{summary[mode].graded}
              </bdi>
            </p>
            <p>
              {t.pending}: <bdi dir="ltr">{summary[mode].pending}</bdi> ·{" "}
              {t.excluded}: <bdi dir="ltr">{summary[mode].excluded}</bdi>
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
