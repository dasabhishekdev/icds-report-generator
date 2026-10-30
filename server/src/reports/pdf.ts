import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';

const CHROME_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findChrome(explicit?: string): string | undefined {
  if (explicit) return explicit;
  return CHROME_CANDIDATES.find((p) => existsSync(p));
}

export interface PdfRenderer {
  render(html: string): Promise<Buffer>;
  close(): Promise<void>;
}

/**
 * Headless Chromium kept warm between requests. Jobs run one at a time to bound memory on a
 * small VPS; the documents are generated server-side, escaped, and all network access is blocked.
 */
export function createPdfRenderer(executablePath: string): PdfRenderer {
  let browser: Promise<Browser> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const getBrowser = () => {
    browser ??= puppeteer
      .launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
      })
      .then((b) => {
        b.on('disconnected', () => {
          browser = null;
        });
        return b;
      })
      .catch((err) => {
        browser = null;
        throw err;
      });
    return browser;
  };

  async function renderNow(html: string): Promise<Buffer> {
    const page = await (await getBrowser()).newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:') || url === 'about:blank') void req.continue();
        else void req.abort();
      });
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('.page'))) {
          const sheet = el.firstElementChild as HTMLElement | null;
          if (!sheet) continue;
          const zoom = Math.min(Number(el.dataset.maxW) / sheet.offsetWidth, Number(el.dataset.maxH) / sheet.offsetHeight);
          sheet.style.zoom = String(zoom);
        }
      });
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 60_000 });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  return {
    render(html) {
      const job = queue.then(() => renderNow(html));
      queue = job.catch(() => undefined);
      return job;
    },
    async close() {
      const b = await browser?.catch(() => null);
      await b?.close();
    },
  };
}
