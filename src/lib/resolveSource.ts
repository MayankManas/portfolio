/**
 * resolveSource.ts - turns a section's `source` (or inline `items`) into the
 * data its renderer consumes, and proves the data is the right shape first.
 *
 * Two gates, both of which must fail loudly and by name:
 *   1. the dotted path resolves at all
 *   2. what it resolved to matches the layout's declared item shape
 *
 * Gate 2 is the one that is easy to omit. `layout: timeline` with
 * `source: skills` passes every other check in the system and then renders
 * nothing useful; caught here it names the section, the layout and the
 * mismatch. Pure - no fs, no Astro - so `npm run validate` can use it too.
 */
import { layoutRegistry, type Resume, type Section } from './schema';

export interface ResolveOk {
  ok: true;
  /** validated, defaults applied */
  data: unknown;
  /** false when the section resolved to nothing renderable and must be skipped */
  renderable: boolean;
}

export interface ResolveError {
  ok: false;
  message: string;
}

export type ResolveResult = ResolveOk | ResolveError;

/** Walks a dotted path such as "basics.headline" or "work". */
function walk(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[key];
  }, root);
}

/** Every dotted path that actually resolves, for "did you mean" suggestions. */
function availablePaths(resume: Resume): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(resume)) {
    paths.push(key);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of Object.keys(value)) paths.push(`${key}.${child}`);
    }
  }
  return paths;
}

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
    }
  }
  return rows[a.length]![b.length]!;
}

function suggest(bad: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score = editDistance(bad.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  // Only suggest when it is plausibly a typo rather than a different word.
  return bestScore <= Math.max(2, Math.floor(bad.length / 3)) ? best : undefined;
}

/** A short description of what was actually found, for the mismatch message. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'an empty list';
    const first = value[0];
    if (first !== null && typeof first === 'object') {
      return `a list whose entries have keys: ${Object.keys(first).join(', ')}`;
    }
    return `a list of ${typeof first}`;
  }
  if (typeof value === 'object') {
    return `an object with keys: ${Object.keys(value as object).join(', ')}`;
  }
  return `a ${typeof value}`;
}

/** True when a section has resolved to nothing worth rendering. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

export function resolveSource(section: Section, resume: Resume): ResolveResult {
  const layout = layoutRegistry[section.layout];
  const label = `section "${section.id}"`;

  // Inline items were already validated against the same schema by
  // sectionSchema, so they only need the emptiness check.
  if (section.items !== undefined) {
    return { ok: true, data: section.items, renderable: !isEmpty(section.items) };
  }

  if (section.source === undefined) {
    return { ok: false, message: `${label}: declares neither "source" nor "items".` };
  }

  const found = walk(resume, section.source);

  if (found === undefined) {
    const hint = suggest(section.source, availablePaths(resume));
    return {
      ok: false,
      message:
        `${label}: source "${section.source}" does not resolve against ` +
        `content/resume.yaml.` +
        (hint ? ` Did you mean "${hint}"?` : '') +
        `\n  Available: ${availablePaths(resume).join(', ')}`,
    };
  }

  // An empty-but-present source is not an error - the section is skipped.
  if (isEmpty(found)) {
    return { ok: true, data: found, renderable: false };
  }

  const parsed = layout.data.safeParse(found);

  if (!parsed.success) {
    // A whole-shape mismatch produces one bare "Invalid input" per entry, which
    // adds nothing the headline has not already said. Only field-level issues
    // are worth printing.
    const detail = parsed.error.issues
      .filter((issue) => issue.message !== 'Invalid input' && issue.path.length > 1)
      .slice(0, 3)
      .map((issue) => `    - ${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n');

    return {
      ok: false,
      message:
        `${label}: layout "${section.layout}" expects ${layout.expects},\n` +
        `  but source "${section.source}" resolved to ${describe(found)}.` +
        (detail ? `\n${detail}` : ''),
    };
  }

  return { ok: true, data: parsed.data, renderable: true };
}
