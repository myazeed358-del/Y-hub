export function exportToPDF(data: {
  title: string;
  userName?: string;
  operation: string;
  inputs: Record<string, string | number>;
  result: string | number;
  proof: string;
  isCorrect?: boolean;
}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export the PDF.');
    return;
  }

  const { title, userName, operation, inputs, result, proof, isCorrect } = data;

  const html = `
    <!DOCTYPE html>
    <html lang="en" dir="ltr">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; background: #fff; }
        .header { border-bottom: 2px solid #1b9177; padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-size: 28px; font-weight: 800; color: #111; margin: 0 0 10px 0; }
        .meta { color: #6b7280; font-size: 14px; }
        .section { margin-bottom: 30px; background: #f9fafb; padding: 25px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .section-title { font-size: 18px; font-weight: bold; margin: 0 0 20px 0; color: #111; display: flex; align-items: center; gap: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; font-weight: 600; }
        .value { font-size: 16px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .result-box { margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 25px; }
        .result-value { font-size: 36px; font-weight: 800; color: #1b9177; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .proof-box { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; overflow-x: auto; margin-top: 12px; color: #374151; }
        .correct { color: #1b9177; font-weight: bold; display: inline-block; padding: 6px 12px; background: #ccfbf1; border-radius: 6px; margin-bottom: 20px; font-size: 15px; }
        .incorrect { color: #e11d48; font-weight: bold; display: inline-block; padding: 6px 12px; background: #ffe4e6; border-radius: 6px; margin-bottom: 20px; font-size: 15px; }
        @media print {
          body { padding: 0; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .section { break-inside: avoid; border: 1px solid #d1d5db; }
          .proof-box { border: 1px solid #d1d5db; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${title}</h1>
        <div class="meta">
          Y-hub &bull; Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          ${userName ? '<br><span style="margin-top: 5px; display: inline-block;">Student Profile: <strong style="color: #111;">' + userName + '</strong></span>' : ''}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Problem Parameters
        </h2>
        <div class="grid">
          <div>
            <div class="label">Operation</div>
            <div class="value" style="text-transform: capitalize;">${operation} T-norm</div>
          </div>
          ${Object.entries(inputs).map(([key, val]) => `
            <div>
              <div class="label">${key}</div>
              <div class="value">${val}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Validation & Proof
        </h2>
        
        ${isCorrect !== undefined ? `
          <div class="${isCorrect ? 'correct' : 'incorrect'}">
            Validation: ${isCorrect ? 'Correct Answer' : 'Incorrect'}
          </div>
        ` : ''}
        
        <div>
          <div class="label">Final Result</div>
          <div class="result-value">${result}</div>
        </div>

        <div class="result-box">
          <div class="label">Algebraic Step-by-Step Proof</div>
          <div class="proof-box">$$ ${proof} $$</div>
        </div>
      </div>
      
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
