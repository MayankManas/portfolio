/**
 * screenshots.ts - `npm run screenshots`.
 *
 * Renders the built site to PNGs in docs/screenshots/. They illustrate
 * CONTENT.md's layout catalogue and give a quick visual regression check in
 * both themes and at both widths.
 *
 * Not part of `npm run build`: these are documentation assets, regenerated
 * deliberately, not on every deploy.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { startStaticServer } from './static-server';

const DIST = 'dist';
const OUT = process.env.SHOT_DIR ?? 'docs/screenshots';

interface Shot {
  name: string;
  path: string;
  width: number;
  height: number;
  scheme: 'light' | 'dark';
  full?: boolean;
  /** capture just this element, for the per-layout catalogue images */
  clip?: string;
}

const SHOTS: Shot[] = [
  { name: 'home-desktop-light', path: '/', width: 1440, height: 1000, scheme: 'light' },
  { name: 'home-desktop-dark', path: '/', width: 1440, height: 1000, scheme: 'dark' },
  { name: 'home-mobile-light', path: '/', width: 375, height: 780, scheme: 'light' },
  { name: 'home-mobile-dark', path: '/', width: 375, height: 780, scheme: 'dark' },
  { name: 'home-full', path: '/', width: 1280, height: 900, scheme: 'light', full: true },
  { name: 'case-study', path: '/projects/fileserver', width: 1280, height: 1000, scheme: 'light' },
  { name: 'resume-print', path: '/resume', width: 900, height: 1200, scheme: 'light', full: true },
  { name: 'notfound', path: '/404.html', width: 1280, height: 600, scheme: 'light' },

  // One per layout, for CONTENT.md's catalogue.
  { name: 'layout-prose', path: '/', width: 1100, height: 600, scheme: 'light', clip: '#about' },
  { name: 'layout-metrics', path: '/', width: 1100, height: 600, scheme: 'light', clip: '#impact' },
  {
    name: 'layout-timeline',
    path: '/',
    width: 1100,
    height: 900,
    scheme: 'light',
    clip: '#experience',
  },
  { name: 'layout-cards', path: '/', width: 1100, height: 700, scheme: 'light', clip: '#projects' },
  { name: 'layout-tags', path: '/', width: 1100, height: 700, scheme: 'light', clip: '#skills' },
  { name: 'layout-contact', path: '/', width: 1100, height: 400, scheme: 'light', clip: '#contact' },
  { name: 'layout-list', path: '/', width: 1100, height: 400, scheme: 'light', clip: '#talks' },
];

async function capture(browser: Browser, origin: string, shot: Shot): Promise<boolean> {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    colorScheme: shot.scheme,
  });
  try {
    await page.goto(origin + shot.path, { waitUntil: 'networkidle' });
    // let the count-up and chip fades settle
    await page.waitForTimeout(400);

    const target = shot.clip ? page.locator(shot.clip) : null;
    if (target && (await target.count()) === 0) {
      console.log(`  skipped ${shot.name} (no ${shot.clip} on the page)`);
      return false;
    }

    const file = join(OUT, `${shot.name}.png`);
    if (target) await target.screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: shot.full ?? false });

    console.log(`  ${shot.name}.png`);
    return true;
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const server = await startStaticServer(DIST);
  const origin = server.origin;

  const browser = await chromium.launch();
  let written = 0;
  try {
    for (const shot of SHOTS) {
      if (await capture(browser, origin, shot)) written += 1;
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`\n${written} screenshots in ${OUT}/`);
}

main().catch((error: unknown) => {
  console.error('\nScreenshot generation failed:\n', error);
  process.exit(1);
});
