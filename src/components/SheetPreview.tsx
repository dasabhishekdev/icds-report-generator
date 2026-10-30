import { useMemo } from 'react';
import { sheetToHtml } from '../reports/html';
import type { SheetModel } from '../reports/sheet';

export { sheetWidthPx } from '../reports/html';

/** On-screen preview; the markup is the same escaped HTML the server prints to PDF. */
export function SheetPreview({ model }: { model: SheetModel }) {
  const html = useMemo(() => sheetToHtml(model), [model]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
