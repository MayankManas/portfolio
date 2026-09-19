/**
 * content.config.ts - the case study markdown collection, and nothing else.
 *
 * resume.yaml and site.yaml are deliberately NOT collections. Each is a single
 * config object rather than a set of entries, so a collection loader would
 * have to invent synthetic ids for `basics`, `work`, `skills` and friends and
 * then union their unrelated shapes into one schema. They are loaded and
 * validated in src/lib/content.ts instead, against src/lib/schema.ts - same
 * Zod guarantees, better errors, and the same schemas are reusable by
 * `npm run validate` outside Astro.
 *
 * content/projects/*.md genuinely IS a collection of entries, and needs
 * Astro's markdown rendering, so it uses one.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/projects' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    stack: z.array(z.string().min(1)).default([]),
    role: z.string().optional(),
    /** false keeps a draft out of the build without deleting it. */
    published: z.boolean().default(true),
  }),
});

export const collections = { projects };
