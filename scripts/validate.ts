/**
 * validate.ts - `npm run validate`.
 *
 * Every content check, with no Astro build. Runs in about a second, so it is
 * usable as a pre-commit reflex and as the first step in CI: if this fails,
 * the build never runs, the deploy never runs, and the previous deployment
 * stays live.
 *
 * It shares src/lib/schema.ts with the build, so the two can never disagree
 * about what valid content is.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { z } from 'zod';

import {
  formatIssues,
  resumeSchema,
  siteSchema,
  type Resume,
  type SiteConfig,
} from '../src/lib/schema';
import { resolveSource } from '../src/lib/resolveSource';
import { crossValidate } from '../src/lib/crossValidate';

const RESUME = 'content/resume.yaml';
const SITE = 'content/site.yaml';
const CASE_STUDIES = 'content/projects';

const problems: string[] = [];
let failed = false;

/** One mistake often produces one issue per array entry; a wall of identical
 *  lines buries the useful ones, so the tail is summarised instead. */
const MAX_LINES_PER_FILE = 10;

function report(file: string, lines: string[]): void {
  if (lines.length === 0) return;
  failed = true;

  const shown = lines.slice(0, MAX_LINES_PER_FILE).map((l) => `  - ${l}`);
  const hidden = lines.length - shown.length;
  if (hidden > 0) shown.push(`  ... and ${hidden} more`);

  problems.push(`${file}\n${shown.join('\n')}`);
}

function loadYaml<S extends z.ZodType>(
  file: string,
  schema: S
): { value: z.infer<S>; raw: unknown } | undefined {
  let raw: unknown;
  try {
    raw = parse(readFileSync(file, 'utf8'));
  } catch (error) {
    report(file, [`not valid YAML: ${(error as Error).message}`]);
    return undefined;
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    report(file, formatIssues(result.error.issues, raw));
    return undefined;
  }
  return { value: result.data, raw };
}

function caseStudySlugs(): string[] {
  try {
    return readdirSync(CASE_STUDIES)
      .filter((name) => name.endsWith('.md') || name.endsWith('.mdx'))
      .map((name) => name.replace(/\.mdx?$/, ''));
  } catch {
    return []; // no case studies yet is a valid state
  }
}

const resume = loadYaml(RESUME, resumeSchema) as { value: Resume } | undefined;
const site = loadYaml(SITE, siteSchema) as { value: SiteConfig } | undefined;

// Section resolution needs both files, so it only runs once each is valid on
// its own - otherwise every section would report a spurious failure.
if (resume && site) {
  const sectionErrors: string[] = [];
  const seen = new Set<string>();

  for (const section of site.value.sections) {
    if (seen.has(section.id)) {
      sectionErrors.push(`section "${section.id}": duplicate id - ids must be unique.`);
    }
    seen.add(section.id);

    const result = resolveSource(section, resume.value);
    if (!result.ok) sectionErrors.push(result.message);
  }

  report(SITE, sectionErrors);
  report('content/', crossValidate({
    projects: resume.value.projects,
    caseStudySlugs: caseStudySlugs(),
  }));
}

if (failed) {
  console.error('\nContent validation failed.\n');
  console.error(problems.join('\n\n'));
  console.error('\nNothing will be built or deployed until this is fixed.\n');
  process.exit(1);
}

const sections = site?.value.sections.length ?? 0;
const work = resume?.value.work.length ?? 0;
const highlights =
  resume?.value.work.reduce(
    (total, job) =>
      total + job.workstreams.reduce((n, ws) => n + ws.highlights.length, 0),
    0
  ) ?? 0;

console.log(
  `Content OK - ${sections} sections, ${work} employer(s), ` +
    `${highlights} highlights, ${resume?.value.skills.length ?? 0} skill groups, ` +
    `${resume?.value.projects.length ?? 0} projects.`
);
