/**
 * build-assets.ts - postbuild. Turns the built site into its two binary
 * artifacts: dist/resume.pdf and dist/og.png.
 *
 * Runs against the BUILT output over a local static server, not against a dev
 * server, so what gets printed is exactly what gets deployed. One Chromium
 * launch does both jobs.
 *
 * Nothing here touches the network beyond localhost.
 */
import { join } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server';
import { loadResume } from './load-content';

const DIST = 'dist';

/** Minimal static server over dist/ - enough to render a page faithfully. */
async function main(): Promise<void> {
  const resume = loadResume();

  const server = await startStaticServer(DIST);
  const origin = server.origin;

  const browser = await chromium.launch();

  try {
    /* ---- resume.pdf ------------------------------------------------------
       print-to-PDF, which produces a real selectable text layer. An
       image-based PDF would be a total failure for an ATS. */
    const sheet = await browser.newPage();
    const response = await sheet.goto(`${origin}/resume`, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`/resume returned ${response?.status()} - was the site built first?`);
    }
    // emulate 'print' so @page and the print rules actually apply
    await sheet.emulateMedia({ media: 'print' });
    await sheet.pdf({
      path: `${DIST}/resume.pdf`,
      format: 'A4',
      printBackground: false,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    await sheet.close();
    console.log('wrote dist/resume.pdf');

    /* ---- og.png ----------------------------------------------------------
       The one place text inside an image is allowed: a social card is not
       page content, and every fact on it also exists as real text in the
       markup. Rendered from the same resume data so it cannot go stale. */
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await card.setContent(ogHtml(resume.basics.name, resume.basics.label), {
      waitUntil: 'load',
    });
    await card.screenshot({ path: `${DIST}/og.png` });
    await card.close();
    console.log('wrote dist/og.png');
  } finally {
    await browser.close();
    await server.close();
  }
}

function ogHtml(name: string, label: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 88px; box-sizing: border-box;
    background: #0d0d0f; color: #ededee;
    font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  .rule { width: 88px; height: 4px; background: #2563eb; margin-bottom: 44px; }
  h1 { font-size: 86px; line-height: 1.05; letter-spacing: -0.025em; margin: 0; font-weight: 650; }
  p  { font-size: 33px; line-height: 1.35; color: #9b9ba5; margin: 28px 0 0; }
</style>
<div class="rule"></div>
<h1>${escape(name)}</h1>
<p>${escape(label)}</p>`;
}

main().catch((error: unknown) => {
  console.error('\nAsset generation failed:\n', error);
  process.exit(1);
});
