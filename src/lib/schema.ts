/**
 * schema.ts - the contract for everything in content/.
 *
 * Pure: no filesystem, no Vite, no Astro. It is imported both by the Astro
 * build (src/lib/content.ts) and by the standalone `npm run validate` script,
 * so it must stay runnable under plain node.
 *
 * `layoutRegistry` below is THE layout registry. Adding a layout means editing
 * exactly two files: this one, and src/components/sections/index.ts.
 */
import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * shared primitives
 * ------------------------------------------------------------------------ */

/**
 * YAML turns an unquoted `2021-07-01` into a Date but leaves `2021-07` a
 * string. Rather than accept both and normalise silently, dates must be quoted
 * - and the error says so, because this will otherwise be hit by a content
 * edit, which is exactly the failure this project exists to prevent.
 */
const dateString = z
  .string({
    error: (issue) =>
      issue.input instanceof Date
        ? 'unquoted date - wrap it in quotes, or YAML turns it into a timestamp'
        : 'expected a date string such as "2021-07"',
  })
  .regex(/^\d{4}(-\d{2})?(-\d{2})?$/, 'expected "YYYY", "YYYY-MM" or "YYYY-MM-DD"');

const url = z.string().min(1);
const nonEmpty = z.string().min(1);

/* ---------------------------------------------------------------------------
 * resume.yaml - the canonical facts
 * ------------------------------------------------------------------------ */

export const profileSchema = z.strictObject({
  network: nonEmpty,
  username: z.string().optional(),
  url: url,
});

export const basicsSchema = z.strictObject({
  name: nonEmpty,
  label: nonEmpty,
  headline: nonEmpty,
  email: nonEmpty,
  phone: z.string().optional(),
  location: z.strictObject({
    city: z.string().optional(),
    region: z.string().optional(),
    country: nonEmpty,
  }),
  availability: z.string().optional(),
  profiles: z.array(profileSchema),
});

/** The three-level nesting is deliberate - see docs/03-architecture.md. */
export const workstreamSchema = z.strictObject({
  name: nonEmpty,
  tech: z.array(nonEmpty).default([]),
  highlights: z.array(nonEmpty).min(1),
});

export const workSchema = z.strictObject({
  company: nonEmpty,
  position: nonEmpty,
  client: z.string().optional(),
  location: z.string().optional(),
  startDate: dateString,
  endDate: dateString.nullable(), // null renders as "Present"
  summary: z.string().optional(),
  workstreams: z.array(workstreamSchema).min(1),
});

export const educationSchema = z.strictObject({
  institution: nonEmpty,
  degree: nonEmpty,
  location: z.string().optional(),
  startDate: dateString,
  endDate: dateString.nullable(),
  score: z.string().optional(),
  awards: z.array(nonEmpty).default([]),
});

export const skillGroupSchema = z.strictObject({
  group: nonEmpty,
  /** Presentation only. All groups always ship in the HTML and in the PDF. */
  priority: z.enum(['primary', 'secondary']).default('secondary'),
  keywords: z.array(nonEmpty).min(1),
});

export const projectSchema = z.strictObject({
  name: nonEmpty,
  blurb: nonEmpty,
  stack: z.array(nonEmpty).default([]),
  /** Presence of a slug is what creates a case study page. */
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only')
    .optional(),
  highlights: z.array(nonEmpty).default([]),
  links: z
    .strictObject({
      repo: url.optional(),
      demo: url.optional(),
    })
    .optional(),
});

export const resumeSchema = z.strictObject({
  basics: basicsSchema,
  work: z.array(workSchema),
  education: z.array(educationSchema),
  skills: z.array(skillGroupSchema),
  projects: z.array(projectSchema),
});

export type Resume = z.infer<typeof resumeSchema>;
export type WorkEntry = z.infer<typeof workSchema>;
export type EducationEntry = z.infer<typeof educationSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Profile = z.infer<typeof profileSchema>;

/* ---------------------------------------------------------------------------
 * the layout registry
 *
 * Each entry declares the shape of the data its renderer CONSUMES - not the
 * shape of the section descriptor. This is what catches `layout: timeline`
 * with `source: skills`: a valid layout and a resolvable path, but the wrong
 * data. Without it that combination reaches the renderer and fails there, with
 * an error naming nothing useful.
 * ------------------------------------------------------------------------ */

export const metricItemSchema = z.strictObject({
  label: nonEmpty,
  value: nonEmpty,
  sublabel: z.string().optional(),
});

/** timeline serves both `work` and `education`, which are genuinely different. */
export const timelineItemSchema = z.union([workSchema, educationSchema]);

export const listItemSchema = z.strictObject({
  label: nonEmpty,
  meta: z.string().optional(),
  href: url.optional(),
});

export const layoutRegistry = {
  prose: {
    data: z.string().min(1),
    expects: 'a markdown string',
  },
  metrics: {
    data: z.array(metricItemSchema),
    expects: 'a list of { label, value }',
  },
  timeline: {
    data: z.array(timelineItemSchema),
    expects:
      'a list of work entries { company, position, startDate, workstreams } ' +
      'or education entries { institution, degree, startDate }',
  },
  cards: {
    data: z.array(projectSchema),
    expects: 'a list of projects { name, blurb, stack?, slug? }',
  },
  tags: {
    data: z.array(skillGroupSchema),
    expects: 'a list of skill groups { group, keywords[] }',
  },
  list: {
    data: z.array(listItemSchema),
    expects: 'a list of { label, meta?, href? }',
  },
  contact: {
    data: z.array(profileSchema),
    expects: 'a list of profiles { network, url }',
  },
} as const satisfies Record<string, { data: z.ZodType; expects: string }>;

export type LayoutName = keyof typeof layoutRegistry;

export const LAYOUT_NAMES = Object.keys(layoutRegistry) as LayoutName[];

/* ---------------------------------------------------------------------------
 * site.yaml - presentation
 * ------------------------------------------------------------------------ */

const sectionVariants = LAYOUT_NAMES.map((layout) =>
  z.strictObject({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only'),
    /** null renders the section without a heading. */
    title: z.string().nullable().default(null),
    layout: z.literal(layout),
    /** a dotted path into resume.yaml */
    source: z.string().optional(),
    /** inline data instead of a source - validated against the same shape */
    items: layoutRegistry[layout].data.optional(),
  })
);

type SectionVariant = (typeof sectionVariants)[number];

export const sectionSchema = z
  .discriminatedUnion(
    'layout',
    // Built from the registry so the two can never drift; zod wants a tuple.
    sectionVariants as unknown as [SectionVariant, SectionVariant, ...SectionVariant[]]
  )
  .superRefine((section, ctx) => {
    const hasSource = section.source !== undefined;
    const hasItems = section.items !== undefined;
    if (hasSource && hasItems) {
      ctx.addIssue({
        code: 'custom',
        message: 'declares both "source" and "items" - use exactly one',
      });
    }
    if (!hasSource && !hasItems) {
      ctx.addIssue({
        code: 'custom',
        message: 'declares neither "source" nor "items" - use exactly one',
      });
    }
  });

export type Section = z.infer<typeof sectionSchema>;

export const siteSchema = z.strictObject({
  meta: z.strictObject({
    title: nonEmpty,
    description: nonEmpty,
    url: url,
  }),
  theme: z.strictObject({
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, 'expected a hex colour such as "#2563eb"'),
    mode: z.enum(['system', 'light', 'dark']).default('system'),
  }),
  sections: z.array(sectionSchema),
});

export type SiteConfig = z.infer<typeof siteSchema>;

/* ---------------------------------------------------------------------------
 * error reporting
 * ------------------------------------------------------------------------ */

/**
 * Turns zod issues into lines that name the offending section by its `id`
 * rather than by array index, because "sections[3]" tells the user nothing
 * when they are looking at a YAML file.
 */
export function formatIssues(
  issues: readonly z.core.$ZodIssue[],
  raw: unknown
): string[] {
  const rawSections =
    raw !== null && typeof raw === 'object' && 'sections' in raw && Array.isArray(raw.sections)
      ? (raw.sections as { id?: string }[])
      : undefined;

  return issues.map((issue) => {
    const path = issue.path.map(String);
    let where = path.join('.') || '(root)';

    if (rawSections && path[0] === 'sections' && /^\d+$/.test(path[1] ?? '')) {
      const entry = rawSections[Number(path[1])];
      const id = entry?.id ? `"${entry.id}"` : `#${path[1]}`;
      const rest = path.slice(2).join('.');
      where = `section ${id}${rest ? ` -> ${rest}` : ''}`;
    }

    return `${where}: ${issue.message}`;
  });
}
