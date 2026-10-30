import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inlines the bundled Noto Sans Bengali faces (from @fontsource) as data URIs so the PDF
 * browser never loads anything from disk or the network and Bengali text shapes correctly.
 */
export function embeddedFontCss(fontDir: string): string {
  return ['400.css', '700.css']
    .map((file) => readFileSync(join(fontDir, file), 'utf8'))
    .join('\n')
    .replace(/src:\s*url\(\.\/files\/([\w.-]+\.woff2)\)\s*format\('woff2'\)[^;]*;/g, (_match, name: string) => {
      const data = readFileSync(join(fontDir, 'files', name)).toString('base64');
      return `src: url(data:font/woff2;base64,${data}) format('woff2');`;
    });
}
