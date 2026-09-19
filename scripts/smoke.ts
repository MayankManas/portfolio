/**
 * smoke.ts - `npm run smoke`.
 *
 * Drives the BUILT site in a real browser and asserts the things static
 * analysis cannot see: that the toggles actually toggle, that the count-up
 * lands on the right number, that the page is navigable by keyboard, and that
 * every bullet is still present with JavaScript switched off.
 *
 * The last check is the important one. Everything else is polish; that one is
 * the project's primary requirement.
 */
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { startStaticServer } from './static-server';
import { loadResume } from './load-content';

const DIST = 'dist';
let failures = 0;
function check(label: string, pass: boolean, detail = ''): void {
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
}

async function run(browser: Browser, origin: string): Promise<void> {
  const resume = loadResume();
  const totalHighlights = resume.work
    .flatMap((job) => job.workstreams)
    .reduce((n, ws) => n + ws.highlights.length, 0);

  /* ---- theme toggle ------------------------------------------------------ */
  console.log('\ntheme toggle');
  {
    const page = await browser.newPage({ colorScheme: 'light' });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    const toggle = page.locator('#theme-toggle');
    check('visible once JS runs', await toggle.isVisible());
    check(
      'starts resolved light',
      (await page.locator('html').getAttribute('data-resolved-theme')) === 'light'
    );

    await toggle.click();
    check(
      'click switches to dark',
      (await page.locator('html').getAttribute('data-theme')) === 'dark'
    );
    check('aria-pressed updates', (await toggle.getAttribute('aria-pressed')) === 'true');

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('background actually repaints dark', bg === 'rgb(13, 13, 15)', bg);

    await page.reload({ waitUntil: 'networkidle' });
    check(
      'choice persists across reload',
      (await page.locator('html').getAttribute('data-theme')) === 'dark'
    );
    await page.close();
  }

  /* ---- progressive disclosure -------------------------------------------- */
  console.log('\nprogressive disclosure');
  {
    const page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    const allBullets = page.locator('#experience .bullets li');
    check(
      `all ${totalHighlights} highlights in the DOM while collapsed`,
      (await allBullets.count()) === totalHighlights,
      `found ${await allBullets.count()}`
    );

    const details = page.locator('#experience details');
    const detailCount = await details.count();
    check('collapsed content is visually hidden', !(await details.first().locator('li').first().isVisible()));

    await details.first().locator('summary').click();
    check('a single <details> opens on click', await details.first().locator('li').first().isVisible());
    await details.first().locator('summary').click();

    const expandAll = page.locator('.expand-all');
    check('expand-all is visible', await expandAll.isVisible());
    await expandAll.click();

    let open = 0;
    for (let i = 0; i < detailCount; i += 1) {
      if (await details.nth(i).evaluate((el) => (el as HTMLDetailsElement).open)) open += 1;
    }
    check(`expand-all opens all ${detailCount}`, open === detailCount, `${open} open`);
    check('label flips', (await expandAll.textContent())?.includes('Collapse') === true);

    await expandAll.click();
    let stillOpen = 0;
    for (let i = 0; i < detailCount; i += 1) {
      if (await details.nth(i).evaluate((el) => (el as HTMLDetailsElement).open)) stillOpen += 1;
    }
    check('collapse-all closes all', stillOpen === 0, `${stillOpen} open`);
    await page.close();
  }

  /* ---- count-up ----------------------------------------------------------- */
  console.log('\nmetric count-up');
  {
    const page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    const first = page.locator('[data-countup]').first();
    const expected = await first.getAttribute('data-countup');

    await first.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    check('lands exactly on the final value', (await first.textContent())?.trim() === expected, `expected ${expected}, got ${(await first.textContent())?.trim()}`);
    await page.close();
  }

  /* ---- reduced motion ------------------------------------------------------ */
  {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    const first = page.locator('[data-countup]').first();
    const expected = await first.getAttribute('data-countup');
    check('correct under prefers-reduced-motion', (await first.textContent())?.trim() === expected);
    await page.close();
  }

  /* ---- scroll spy ---------------------------------------------------------- */
  console.log('\nscroll-spy');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    check('visible at desktop width', await page.locator('.spy').isVisible());

    await page.locator('#skills').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const current = await page.locator('.spy a[aria-current="true"]').count();
    check('marks a current section while scrolling', current === 1, `${current} marked`);

    const narrow = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await narrow.goto(`${origin}/`, { waitUntil: 'networkidle' });
    check('hidden below the breakpoint', !(await narrow.locator('.spy').isVisible()));
    await narrow.close();
    await page.close();
  }

  /* ---- keyboard ------------------------------------------------------------ */
  console.log('\nkeyboard');
  {
    const page = await browser.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    await page.keyboard.press('Tab');
    const firstStop = await page.evaluate(() => document.activeElement?.className ?? '');
    check('skip link is the first tab stop', firstStop.includes('skip-link'), firstStop);
    check('skip link becomes visible on focus', await page.locator('.skip-link').isVisible());

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check('skip link jumps to #main', page.url().endsWith('#main'));

    // a <details> summary must be reachable and operable by keyboard alone
    const summary = page.locator('#experience details summary').first();
    await summary.focus();
    await page.keyboard.press('Enter');
    check(
      'details opens with the keyboard',
      await page.locator('#experience details').first().evaluate((el) => (el as HTMLDetailsElement).open)
    );
    await page.close();
  }

  /* ---- JS DISABLED - the requirement ---------------------------------------- */
  console.log('\njavascript disabled');
  {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${origin}/`, { waitUntil: 'load' });

    const bullets = await page.locator('#experience .bullets li').count();
    check(`all ${totalHighlights} highlights present`, bullets === totalHighlights, `found ${bullets}`);

    const groups = await page.locator('#skills dt').count();
    check(`all ${resume.skills.length} skill groups present`, groups === resume.skills.length, `found ${groups}`);

    check('metric figures show their real values', (await page.locator('[data-countup]').first().textContent())?.trim() === (await page.locator('[data-countup]').first().getAttribute('data-countup')));

    // details still open natively without JS
    await page.locator('#experience details summary').first().click();
    check('progressive disclosure still works', await page.locator('#experience details li').first().isVisible());

    check('theme toggle stays hidden', !(await page.locator('#theme-toggle').isVisible()));
    check('body has a painted background', (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== 'rgba(0, 0, 0, 0)');

    const study = await context.newPage();
    await study.goto(`${origin}/projects/fileserver`, { waitUntil: 'load' });
    check('case study readable without JS', (await study.locator('.study__body p').count()) > 5);
    check('progress bar hidden without JS', !(await study.locator('.progress').isVisible()));

    await context.close();
  }

  /* ---- no console errors ----------------------------------------------------- */
  console.log('\nconsole');
  {
    for (const path of ['/', '/projects/fileserver', '/resume', '/404.html']) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      check(`${path} - no console errors`, errors.length === 0, errors.join(' | '));
      await page.close();
    }
  }
}

async function main(): Promise<void> {
  const server = await startStaticServer(DIST);
  const origin = server.origin;
  const browser = await chromium.launch();
  try {
    await run(browser, origin);
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error('\nSmoke test crashed:\n', error);
  process.exit(1);
});
