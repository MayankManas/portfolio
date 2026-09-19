/**
 * content.ts - the Astro-side entry point to content/.
 *
 * The YAML is pulled in with Vite's `?raw` so the dev server watches both files
 * and hot-reloads on a content edit. Reading them with fs would work but would
 * silently break that, and "npm run dev, see it before you commit" is part of
 * the authoring workflow.
 *
 * Validation failures throw. A thrown error fails `astro build`, which stops
 * the deploy, which leaves the previous deployment live - the safety property
 * described in docs/03-architecture.md.
 */
import { parse } from 'yaml';
import type { z } from 'zod';
import rawResume from '../../content/resume.yaml?raw';
import rawSite from '../../content/site.yaml?raw';
import {
  formatIssues,
  resumeSchema,
  siteSchema,
  type Resume,
  type Section,
  type SiteConfig,
} from './schema';
import { resolveSource } from './resolveSource';

function fail(file: string, lines: string[]): never {
  throw new Error(
    `\n${file} is invalid:\n\n` +
      lines.map((line) => `  ${line}`).join('\n') +
      `\n\nNothing was deployed. Fix the content and commit again.\n`
  );
}

function load<S extends z.ZodType>(file: string, raw: string, schema: S): z.infer<S> {
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    fail(file, [`could not be parsed as YAML: ${(error as Error).message}`]);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    fail(file, formatIssues(result.error.issues, parsed));
  }
  return result.data;
}

let resumeCache: Resume | undefined;
let siteCache: SiteConfig | undefined;

export function getResume(): Resume {
  resumeCache ??= load('content/resume.yaml', rawResume, resumeSchema);
  return resumeCache;
}

export function getSite(): SiteConfig {
  siteCache ??= load('content/site.yaml', rawSite, siteSchema);
  return siteCache;
}

export interface ResolvedSection {
  section: Section;
  data: unknown;
}

/**
 * Every section that has something to render, in site.yaml order.
 *
 * Sections resolving to nothing are dropped silently - an empty section is a
 * content state, not an error, and rendering a heading over a hole is worse
 * than rendering nothing.
 */
export function getSections(): ResolvedSection[] {
  const resume = getResume();
  const site = getSite();
  const resolved: ResolvedSection[] = [];
  const errors: string[] = [];

  for (const section of site.sections) {
    const result = resolveSource(section, resume);
    if (!result.ok) {
      errors.push(result.message);
      continue;
    }
    if (result.renderable) {
      resolved.push({ section, data: result.data });
    }
  }

  if (errors.length > 0) fail('content/site.yaml', errors);

  return resolved;
}
