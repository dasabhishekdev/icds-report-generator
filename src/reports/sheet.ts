export type Align = 'left' | 'center' | 'right';

export interface CellStyle {
  bold?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  align?: Align;
  wrap?: boolean;
  border?: boolean;
  numFmt?: string;
}

export interface SheetCell {
  value: string | number | null;
  /** Excel formula without the leading '='; `value` is its pre-computed result for the preview. */
  formula?: string;
  style: CellStyle;
}

export interface Merge {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface SheetModel {
  id: string;
  /** Excel sheet tab name (≤ 31 chars). */
  name: string;
  fileName: string;
  title: string;
  colWidths: number[];
  rowHeights: Record<number, number>;
  cells: Map<string, SheetCell>;
  merges: Merge[];
  rowCount: number;
  landscape: boolean;
}

const NAVY = '1F4E78';
const MONEY = '#,##0.00';

/** Style presets matching the department's register formatting. */
export const S = {
  title: { bold: true, size: 13, color: 'FFFFFF', fill: NAVY, align: 'center', wrap: true },
  info: { bold: true, color: NAVY, fill: 'F2F4F8', align: 'left', wrap: true, border: true },
  infoCenter: { bold: true, color: NAVY, fill: 'F2F4F8', align: 'center', wrap: true },
  header: { bold: true, color: 'FFFFFF', fill: '2F5597', align: 'center', wrap: true, border: true },
  subHeader: { bold: true, size: 9, color: NAVY, fill: 'D9E1F2', align: 'center', wrap: true, border: true },
  section: { bold: true, color: NAVY, fill: 'D9E1F2', align: 'left', wrap: true },
  cell: { align: 'center', wrap: true, border: true },
  cellBold: { bold: true, align: 'center', wrap: true, border: true },
  text: { align: 'left', wrap: true, border: true },
  money: { align: 'right', wrap: true, border: true, numFmt: MONEY },
  moneyBold: { bold: true, align: 'right', wrap: true, border: true, numFmt: MONEY },
  holiday: { bold: true, color: 'C00000', fill: 'FCE4D6', align: 'center', wrap: true, border: true },
  holidayCell: { fill: 'FCE4D6', align: 'center', wrap: true, border: true },
  total: { bold: true, fill: 'EAEEF7', align: 'center', wrap: true, border: true },
  totalLeft: { bold: true, fill: 'EAEEF7', align: 'left', wrap: true, border: true },
  totalMoney: { bold: true, fill: 'EAEEF7', align: 'right', wrap: true, border: true, numFmt: MONEY },
  label: { bold: true, color: NAVY },
  plain: {},
  footer: { bold: true, color: NAVY, fill: 'F2F4F8', wrap: true },
} satisfies Record<string, CellStyle>;

export const ZEBRA = 'F9FAFC';

export function colLetter(col: number): string {
  let s = '';
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function colNumber(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

export function parseAddress(addr: string): { r: number; c: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  if (!m) throw new Error(`Bad cell address ${addr}`);
  return { r: Number(m[2]), c: colNumber(m[1]) };
}

export const addr = (r: number, c: number) => `${colLetter(c)}${r}`;

export class SheetBuilder {
  private model: SheetModel;

  constructor(init: Pick<SheetModel, 'id' | 'name' | 'fileName' | 'title' | 'colWidths' | 'landscape'>) {
    this.model = { ...init, rowHeights: {}, cells: new Map(), merges: [], rowCount: 0 };
  }

  set(
    address: string,
    value: string | number | null | undefined,
    style: CellStyle = S.cell,
    formula?: string,
  ): this {
    const { r } = parseAddress(address);
    this.model.cells.set(address, { value: value ?? null, formula, style });
    this.model.rowCount = Math.max(this.model.rowCount, r);
    return this;
  }

  /** Writes a value and styles every cell of the merged range so borders and fills render in full. */
  mergeSet(range: string, value: string | number | null, style: CellStyle = S.cell, formula?: string): this {
    const [a, b] = range.split(':').map(parseAddress);
    this.model.merges.push({ r1: a.r, c1: a.c, r2: b.r, c2: b.c });
    for (let r = a.r; r <= b.r; r++) {
      for (let c = a.c; c <= b.c; c++) {
        if (r === a.r && c === a.c) continue;
        this.model.cells.set(addr(r, c), { value: null, style });
      }
    }
    return this.set(addr(a.r, a.c), value, style, formula);
  }

  height(row: number, h: number): this {
    this.model.rowHeights[row] = h;
    return this;
  }

  build(): SheetModel {
    return this.model;
  }
}

export const zebra = (style: CellStyle, index: number): CellStyle =>
  index % 2 === 0 && !style.fill ? { ...style, fill: ZEBRA } : style;

/** Blank instead of 0 for quantities that were not given that day, like the hand-made registers. */
export const blankZero = (n: number): number | null => (n === 0 ? null : n);
