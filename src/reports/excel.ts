import ExcelJS from 'exceljs';
import type { PaperSize } from '../db/schema';
import { PAPER } from './paper';
import type { CellStyle, SheetModel } from './sheet';

const BORDER_COLOR = { argb: 'FFA6A6A6' };
const thin = { style: 'thin' as const, color: BORDER_COLOR };

function applyStyle(cell: ExcelJS.Cell, style: CellStyle) {
  cell.font = {
    name: 'Calibri',
    size: style.size ?? 10,
    bold: style.bold ?? false,
    color: { argb: `FF${style.color ?? '000000'}` },
  };
  cell.alignment = {
    horizontal: style.align,
    vertical: 'middle',
    wrapText: style.wrap ?? false,
  };
  if (style.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${style.fill}` } };
  if (style.border) cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  if (style.numFmt) cell.numFmt = style.numFmt;
}

function addSheet(wb: ExcelJS.Workbook, model: SheetModel, paper: PaperSize) {
  const ws = wb.addWorksheet(model.name.slice(0, 31), {
    pageSetup: {
      paperSize: PAPER[paper].excelCode as ExcelJS.PageSetup['paperSize'],
      orientation: model.landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });
  model.colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  for (const [row, h] of Object.entries(model.rowHeights)) ws.getRow(Number(row)).height = h;
  for (const [address, data] of model.cells) {
    const cell = ws.getCell(address);
    if (data.formula) {
      cell.value = { formula: data.formula, result: data.value ?? undefined } as ExcelJS.CellFormulaValue;
    } else {
      cell.value = data.value;
    }
    applyStyle(cell, data.style);
  }
  for (const m of model.merges) ws.mergeCells(m.r1, m.c1, m.r2, m.c2);
  return ws;
}

export async function workbookBlob(models: SheetModel[], paper: PaperSize = 'A4'): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ICDS Report Generator';
  wb.created = new Date();
  for (const m of models) addSheet(wb, m, paper);
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}