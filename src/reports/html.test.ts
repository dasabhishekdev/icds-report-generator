import { describe, expect, it } from 'vitest';
import { sheetToHtml } from './html';
import { S, SheetBuilder } from './sheet';

describe('sheetToHtml', () => {
  it('escapes user-entered text and renders merges', () => {
    const b = new SheetBuilder({ id: 't', name: 't', fileName: 't', title: 't', colWidths: [10, 10], landscape: false });
    b.mergeSet('A1:B1', '<img src=x onerror=alert(1)> "Centre" & Co', S.title);
    b.set('A2', 9072.64, S.money);
    const html = sheetToHtml(b.build());
    expect(html).not.toContain('<img');
    expect(html).toContain('&#60;img src=x onerror=alert(1)&#62; &#34;Centre&#34; &#38; Co');
    expect(html).toContain('colspan="2"');
    expect(html).toContain('9,072.64');
  });
});
