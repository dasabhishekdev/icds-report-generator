import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { PaperSize } from '../db/schema';
import { pageMm, PRINT_MARGIN_MM } from './paper';
import type { SheetModel } from './sheet';

/** Rasterises each rendered sheet (one page per report) so Bengali text keeps the browser's shaping. */
export async function sheetsToPdf(pages: { model: SheetModel; element: HTMLElement }[], paper: PaperSize): Promise<Blob> {
  const format = paper.toLowerCase();
  let pdf: jsPDF | null = null;
  for (const { model, element } of pages) {
    const orientation = model.landscape ? 'landscape' : 'portrait';
    const { w: pageW, h: pageH } = pageMm(paper, model.landscape);
    if (!pdf) pdf = new jsPDF({ orientation, unit: 'mm', format });
    else pdf.addPage(format, orientation);

    const canvas = await html2canvas(element, {
      scale: paper === 'A3' ? 2.5 : 2,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    const maxW = pageW - PRINT_MARGIN_MM * 2;
    const maxH = pageH - PRINT_MARGIN_MM * 2;
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pageW - w) / 2, PRINT_MARGIN_MM, w, h);
  }
  if (!pdf) throw new Error('No report to export');
  return pdf.output('blob');
}
