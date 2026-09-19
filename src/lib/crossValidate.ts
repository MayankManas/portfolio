/**
 * crossValidate.ts - checks that span two files, which no single schema can
 * express.
 *
 * The slug rule is bidirectional on purpose: a slug with no markdown file
 * produces a dead "Read case study" link, and a markdown file with no project
 * entry is an orphan page nothing links to. Both are silent failures on a live
 * site, so both fail the build instead.
 */
import type { Project } from './schema';

export interface CrossValidateInput {
  projects: Pick<Project, 'name' | 'slug'>[];
  /** slugs of the markdown files present in content/projects/ */
  caseStudySlugs: string[];
}

export function crossValidate({ projects, caseStudySlugs }: CrossValidateInput): string[] {
  const errors: string[] = [];
  const onDisk = new Set(caseStudySlugs);

  const declared = new Map<string, string>();
  for (const project of projects) {
    if (project.slug === undefined) continue;

    const duplicate = declared.get(project.slug);
    if (duplicate !== undefined) {
      errors.push(
        `project "${project.name}": slug "${project.slug}" is already used by ` +
          `"${duplicate}" - slugs must be unique.`
      );
      continue;
    }
    declared.set(project.slug, project.name);

    if (!onDisk.has(project.slug)) {
      errors.push(
        `project "${project.name}": declares slug "${project.slug}" but ` +
          `content/projects/${project.slug}.md does not exist.\n` +
          `  Either create that file, or remove the slug to render a card only.`
      );
    }
  }

  for (const slug of caseStudySlugs) {
    if (!declared.has(slug)) {
      errors.push(
        `content/projects/${slug}.md has no matching project in ` +
          `content/resume.yaml.\n` +
          `  Add a projects entry with "slug: ${slug}", or delete the file.`
      );
    }
  }

  return errors;
}
