import type { PaperSize } from '../db/schema';

export const PAPER_SIZES: readonly PaperSize[] = ['A4', 'A3'];

interface PaperSpec {
  /** Portrait width × height in millimetres. */
  widthMm: number;
  heightMm: number;
  /** OOXML paperSize code used by Excel page setup. */
  excelCode: number;
}

export const PAPER: Record<PaperSize, PaperSpec> = {
  A4: { widthMm: 210, heightMm: 297, excelCode: 9 },
  A3: { widthMm: 297, heightMm: 420, excelCode: 8 },
};

export const PRINT_MARGIN_MM = 10;

export function pageMm(paper: PaperSize, landscape: boolean): { w: number; h: number } {
  const { widthMm, heightMm } = PAPER[paper];
  return landscape ? { w: heightMm, h: widthMm } : { w: widthMm, h: heightMm };
}

/** Printable width in CSS pixels (96 dpi) inside the print margins. */
export function printableWidthPx(paper: PaperSize, landscape: boolean): number {
  return Math.floor(((pageMm(paper, landscape).w - PRINT_MARGIN_MM * 2) / 25.4) * 96);
}
