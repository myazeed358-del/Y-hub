import type { AttendanceReport } from "../repository";
import { reportCells } from "./export";
export function ReportTable(
  { rows, ar }: { rows: AttendanceReport["rows"]; ar: boolean },
) {
  const [header, ...cells] = reportCells(rows, ar);
  if (!rows.length) {
    return <p>{ar ? "لا توجد سجلات مطابقة." : "No matching records."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {header.map((h) => <th key={h} className="p-2 text-start">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {cells.map((r, i) => (
            <tr key={rows[i].id} className="border-t border-border">
              {r.map((v, j) => (
                <td key={j} className="p-2" dir={j === 1 ? "ltr" : undefined}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
