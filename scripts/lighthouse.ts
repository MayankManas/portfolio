/**
 * lighthouse.ts - `npm run lighthouse`.
 *
 * Audits the BUILT site against the >=95 target in docs/02-design.md, using
 * Playwright's Chromium so there is no second browser to install.
 */
import { chromium } from 'playwright';
import { startStaticServer } from './static-server';
import lighthouse from 'lighthouse';

const DIST = 'dist';
const TARGET = 95;
const ROUTES = ['/', '/projects/fileserver'];

async function main(): Promise<void> {
  const server = await startStaticServer(DIST);
  const origin = server.origin;

  const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
  let failed = false;

  try {
    for (const route of ROUTES) {
      const result = await lighthouse(origin + route, {
        port: 9222,
        output: 'json',
        logLevel: 'error',
        screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        formFactor: 'desktop',
        throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
      });
      if (!result) throw new Error(`lighthouse returned nothing for ${route}`);

      console.log(`\n${route}`);
      for (const [key, category] of Object.entries(result.lhr.categories)) {
        const score = Math.round((category.score ?? 0) * 100);
        const ok = score >= TARGET;
        if (!ok) failed = true;
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${category.title.padEnd(16)} ${score}`);
      }

      // Name what actually lost points, so the number is actionable.
      const misses = Object.values(result.lhr.audits).filter(
        (a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary'
      );
      if (misses.length > 0) {
        console.log('    failing audits:');
        for (const m of misses) console.log(`      - ${m.title}`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(failed ? `\nBelow the ${TARGET} target.\n` : `\nAll categories >= ${TARGET}.\n`);
  if (failed) process.exit(1);
}

main().catch((e: unknown) => {
  console.error('\nLighthouse run failed:\n', e);
  process.exit(1);
});
