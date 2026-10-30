import type { PaperSize } from '../../../src/db/schema';
import { escapeHtml, sheetToHtml } from '../../../src/reports/html';
import { PRINT_MARGIN_MM, printableHeightPx, printableWidthPx } from '../../../src/reports/paper';
import type { SheetModel } from '../../../src/reports/sheet';

/**
 * A print document with one page per report. Each page uses a named @page so portrait and
 * landscape registers can share one PDF; the renderer then zooms each sheet to fill its page.
 */
export function reportsDocument(models: SheetModel[], paper: PaperSize, fontCss: string, title: string): string {
  const pages = models
    .map((m) => {
      const orientation = m.landscape ? 'landscape' : 'portrait';
      return (
        `<section class="page ${orientation}" data-max-w="${printableWidthPx(paper, m.landscape)}" ` +
        `data-max-h="${printableHeightPx(paper, m.landscape)}">${sheetToHtml(m)}</section>`
      );
    })
    .join('');
  return `<!doctype html>
<html lang="bn"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>${escapeHtml(title)}</title>
<style>
${fontCss}
@page portrait { size: ${paper} portrait; margin: ${PRINT_MARGIN_MM}mm; }
@page landscape { size: ${paper} landscape; margin: ${PRINT_MARGIN_MM}mm; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Noto Sans Bengali', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { break-after: page; overflow: hidden; }
.page:last-child { break-after: auto; }
.page.portrait { page: portrait; }
.page.landscape { page: landscape; }
</style></head><body>${pages}</body></html>`;
}
