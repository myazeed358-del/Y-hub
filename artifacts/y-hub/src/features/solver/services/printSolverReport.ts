import { renderSolverReportHtml } from './renderSolverReportHtml';
import type { SolverReportData } from './renderSolverReportHtml';

/** Thin browser adapter; rendering and escaping live in a pure module. */
export function exportToPDF(data: SolverReportData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the PDF.');
    return;
  }

  const html = renderSolverReportHtml(data);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
