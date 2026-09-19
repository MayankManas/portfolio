/**
 * load-content.ts - node-side content loading for scripts.
 *
 * src/lib/content.ts reads the YAML through Vite's `?raw` so the dev server
 * hot-reloads on a content edit; that import only works inside Astro. Scripts
 * need the same data outside it, so they read the files directly here - but
 * against the SAME schemas, so there is still exactly one definition of what
 * valid content is.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resumeSchema, siteSchema, type Resume, type SiteConfig } from '../src/lib/schema';

export function loadResume(): Resume {
  return resumeSchema.parse(parse(readFileSync('content/resume.yaml', 'utf8')));
}

export function loadSite(): SiteConfig {
  return siteSchema.parse(parse(readFileSync('content/site.yaml', 'utf8')));
}
