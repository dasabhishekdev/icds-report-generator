import { addr, type CellStyle, type SheetModel } from './sheet';

/**
 * One HTML rendering of a report sheet, shared by the on-screen preview and the server-side
 * Puppeteer PDF so both always show exactly the same layout.
 */

/** Excel column width units / row points → CSS pixels. */
export const colPx = (w: number) => Math.round(w * 7 + 5);
const rowPx = (pt: number) => Math.round(pt * 1.33);
const SHEET_PADDING = 12;

export const sheetWidthPx = (model: SheetModel) => model.colWidths.reduce((s, w) => s + colPx(w), 0) + SHEET_PADDING * 2;

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function formatValue(v: string | number | null, style: CellStyle): string {
  if (v === null) return '';
  if (typeof v === 'number' && style.numFmt === '#,##0.00') {
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return v;
}

/** Only fixed, validated values reach the style attribute; colours are 6-digit hex from the presets. */
function cellCss(style: CellStyle): string {
  const hex = (c: string) => (/^[0-9A-Fa-f]{6}$/.test(c) ? `#${c}` : '#000000');
  const css = [
    `font-weight:${style.bold ? 700 : 400}`,
    `font-size:${((style.size ?? 10) * 1.33).toFixed(1)}px`,
    `color:${hex(style.color ?? '000000')}`,
    `text-align:${style.align ?? 'left'}`,
    `white-space:${style.wrap ? 'pre-line' : 'nowrap'}`,
    `overflow:${style.wrap ? 'hidden' : 'visible'}`,
    'padding:2px 4px',
    'vertical-align:middle',
    'line-height:1.25',
  ];
  if (style.fill) css.push(`background:${hex(style.fill)}`);
  if (style.border) css.push('border:1px solid #a6a6a6');
  return css.join(';');
}

export function sheetToHtml(model: SheetModel): string {
  const covered = new Set<string>();
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const m of model.merges) {
    spans.set(addr(m.r1, m.c1), { rowSpan: m.r2 - m.r1 + 1, colSpan: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(addr(r, c));
    }
  }
  const width = sheetWidthPx(model) - SHEET_PADDING * 2;
  const cols = model.colWidths.map((w) => `<col style="width:${colPx(w)}px">`).join('');
  const rows: string[] = [];
  for (let r = 1; r <= model.rowCount; r++) {
    const h = model.rowHeights[r];
    const cells: string[] = [];
    for (let c = 1; c <= model.colWidths.length; c++) {
      const a = addr(r, c);
      if (covered.has(a)) continue;
      const cell = model.cells.get(a);
      const span = spans.get(a);
      const style = cell?.style ?? {};
      const spanAttr = span ? ` rowspan="${span.rowSpan}" colspan="${span.colSpan}"` : '';
      cells.push(`<td${spanAttr} style="${cellCss(style)}">${cell ? escapeHtml(formatValue(cell.value, style)) : ''}</td>`);
    }
    rows.push(`<tr style="height:${h ? rowPx(h) : 20}px">${cells.join('')}</tr>`);
  }
  return (
    `<div class="sheet" style="display:inline-block;background:#fff;padding:${SHEET_PADDING}px;width:${width + SHEET_PADDING * 2}px">` +
    `<table style="border-collapse:collapse;table-layout:fixed;width:${width}px;font-family:'Noto Sans Bengali',Calibri,sans-serif">` +
    `<colgroup>${cols}</colgroup><tbody>${rows.join('')}</tbody></table></div>`
  );
}
