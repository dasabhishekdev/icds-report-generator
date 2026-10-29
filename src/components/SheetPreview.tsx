import type { CSSProperties, Ref } from 'react';
import { addr, type CellStyle, type SheetModel } from '../reports/sheet';

/** Excel column width units / row points → CSS pixels. */
const colPx = (w: number) => Math.round(w * 7 + 5);
const rowPx = (pt: number) => Math.round(pt * 1.33);

export const sheetWidthPx = (model: SheetModel) => model.colWidths.reduce((s, w) => s + colPx(w), 0) + 24;

function formatValue(v: string | number | null, style: CellStyle): string {
  if (v === null) return '';
  if (typeof v === 'number' && style.numFmt === '#,##0.00') {
    return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof v === 'number') return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return v;
}

function cssFor(style: CellStyle): CSSProperties {
  return {
    fontWeight: style.bold ? 700 : 400,
    fontSize: `${((style.size ?? 10) * 1.33).toFixed(1)}px`,
    color: `#${style.color ?? '000000'}`,
    background: style.fill ? `#${style.fill}` : undefined,
    textAlign: style.align ?? 'left',
    whiteSpace: style.wrap ? 'pre-line' : 'nowrap',
    border: style.border ? '1px solid #a6a6a6' : undefined,
  };
}

/** Renders a report exactly as laid out in the Excel sheet; also the source image for PDF export. */
export function SheetPreview({ model, ref }: { model: SheetModel; ref?: Ref<HTMLDivElement> }) {
  const covered = new Set<string>();
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  for (const m of model.merges) {
    spans.set(addr(m.r1, m.c1), { rowSpan: m.r2 - m.r1 + 1, colSpan: m.c2 - m.c1 + 1 });
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(addr(r, c));
    }
  }
  const cols = model.colWidths.length;
  const width = sheetWidthPx(model) - 24;

  return (
    <div ref={ref} className="inline-block bg-white p-3" style={{ width: width + 24 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width,
          fontFamily: "'Noto Sans Bengali', Calibri, sans-serif",
        }}
      >
        <colgroup>
          {model.colWidths.map((w, i) => (
            <col key={i} style={{ width: colPx(w) }} />
          ))}
        </colgroup>
        <tbody>
          {Array.from({ length: model.rowCount }, (_, ri) => {
            const r = ri + 1;
            const h = model.rowHeights[r];
            return (
              <tr key={r} style={{ height: h ? rowPx(h) : 20 }}>
                {Array.from({ length: cols }, (_, ci) => {
                  const a = addr(r, ci + 1);
                  if (covered.has(a)) return null;
                  const cell = model.cells.get(a);
                  const span = spans.get(a);
                  const style = cell?.style ?? {};
                  return (
                    <td
                      key={a}
                      rowSpan={span?.rowSpan}
                      colSpan={span?.colSpan}
                      style={{
                        ...cssFor(style),
                        padding: '2px 4px',
                        verticalAlign: 'middle',
                        overflow: style.wrap ? 'hidden' : 'visible',
                        lineHeight: 1.25,
                      }}
                    >
                      {cell ? formatValue(cell.value, style) : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
