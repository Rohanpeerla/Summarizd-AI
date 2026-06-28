import type { SummaryResult } from "./summarizer";

interface SummarySection {
  title: string;
  result: SummaryResult;
}

export function downloadSummaryAsPdf(title: string, result: SummaryResult): void {
  openPrintWindow([{ title, result }]);
}

export function downloadAllSummariesAsPdf(
  sections: SummarySection[],
  combinedTitle?: string,
  combinedResult?: SummaryResult | null
): void {
  const allSections = [...sections];
  if (combinedResult && combinedTitle) {
    allSections.push({ title: combinedTitle, result: combinedResult });
  }
  openPrintWindow(allSections);
}

function openPrintWindow(sections: SummarySection[]): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups to download/print summaries.");
    return;
  }

  const html = buildHtml(sections);
  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.error("Print failed:", e);
    }
  }, 300);
}

function buildHtml(sections: SummarySection[]): string {
  const sectionsHtml = sections
    .map(({ title, result }, index) => {
      const bullets = result.bullets
        .map((b, i) => `<li><span class="number">${i + 1}</span><span class="text">${escapeHtml(b)}</span></li>`)
        .join("");

      const keywords = result.keywords
        .map((k) => `<span class="keyword">${escapeHtml(k.word)} <small>(${k.count})</small></span>`)
        .join("");

      return `
        <div class="section ${index > 0 ? "page-break" : ""}">
          <div class="header">
            <h1>${escapeHtml(title)}</h1>
            <div class="stats">
              Words: ${result.stats.summaryWords} • 
              Sentences: ${result.stats.summarySentences}/${result.stats.originalSentences} • 
              Compressed: ${result.stats.compression}%
            </div>
          </div>
          <div class="divider"></div>
          
          <h2>Summary</h2>
          <p class="summary">${escapeHtml(result.summary).replace(/\n/g, "</p><p class=\"summary\">")}</p>
          
          ${result.bullets.length ? `
            <h2>Key Points</h2>
            <ul class="bullets">
              ${bullets}
            </ul>
          ` : ""}
          
          ${result.keywords.length ? `
            <h2>Keywords</h2>
            <div class="keywords">
              ${keywords}
            </div>
          ` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Summarizd Summary</title>
      <style>
        @page { margin: 20mm; size: auto; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1f2937;
          background: #fff;
          line-height: 1.6;
          margin: 0;
          padding: 0;
        }
        .section { padding: 30px 40px; }
        .page-break { page-break-before: always; }
        .header { margin-bottom: 12px; }
        h1 {
          color: #0f172a;
          font-size: 28px;
          margin: 0 0 6px 0;
          line-height: 1.2;
        }
        .stats {
          color: #64748b;
          font-size: 12px;
        }
        .divider {
          height: 2px;
          background: linear-gradient(90deg, #0f172a, #94a3b8);
          border-radius: 2px;
          margin: 16px 0 24px 0;
        }
        h2 {
          color: #111827;
          font-size: 16px;
          margin: 24px 0 10px 0;
        }
        .summary {
          font-size: 13px;
          color: #374151;
          margin: 0 0 12px 0;
          text-align: justify;
        }
        .bullets {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .bullets li {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 13px;
          color: #374151;
        }
        .bullets .number {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #0f172a;
          color: #fff;
          font-size: 11px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .bullets .text { flex: 1; }
        .keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .keyword {
          background: #f1f5f9;
          color: #0f172a;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }
        .keyword small {
          color: #64748b;
          font-weight: normal;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${sectionsHtml}
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
