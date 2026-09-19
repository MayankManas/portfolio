/**
 * /llms.txt - a clean prose rendering of the whole site for language models.
 *
 * Generated from the same YAML as everything else, so it cannot go stale. No
 * markup, no navigation chrome, no duplicated boilerplate - just the facts in
 * reading order, which is exactly what a model summarising this person needs
 * and exactly what HTML makes it dig for.
 *
 * Every highlight and every skill group appears here in full: nothing is
 * collapsed, because there is no reader to overwhelm.
 *
 * Follows the llmstxt.org shape: an H1, a blockquote summary, then H2 sections
 * whose entries are real markdown links. Bare URLs read fine to a human but
 * fail the spec - and its own validator then reports the file as containing no
 * links at all, which defeats the point of publishing it.
 */
import type { APIRoute } from 'astro';
import { getResume, getSite } from '../lib/content';
import { formatRange } from '../lib/formatDate';
import { real } from '../lib/placeholder';

export const prerender = true;

export const GET: APIRoute = () => {
  const resume = getResume();
  const site = getSite();
  const base = site.meta.url.replace(/\/$/, '');
  const { basics } = resume;

  const out: string[] = [];
  const push = (line = '') => out.push(line);

  push(`# ${basics.name}`);
  push();
  push(`> ${basics.label}`);
  push();
  push(basics.headline.replace(/\s+/g, ' ').trim());
  push();

  // ---- contact -------------------------------------------------------------
  push('## Contact');
  push();
  const location = [
    real(basics.location.city),
    real(basics.location.region),
    basics.location.country,
  ]
    .filter(Boolean)
    .join(', ');
  push(`- Location: ${location}`);
  if (basics.availability) push(`- Availability: ${basics.availability}`);
  push(`- [Email](mailto:${basics.email}): ${basics.email}`);
  const phone = real(basics.phone);
  if (phone) push(`- [Phone](tel:${phone.replace(/[^+\d]/g, '')}): ${phone}`);
  for (const profile of basics.profiles) {
    const url = real(profile.url);
    if (url) push(`- [${profile.network}](${url}): ${profile.username ?? url}`);
  }
  push();

  push('## Links');
  push();
  push(`- [Website](${base}): the full portfolio`);
  push(`- [Resume PDF](${base}/resume.pdf): ATS-safe, generated from the same source as this file`);
  push(`- [Structured data](${base}/api/portfolio.json): the whole resume as JSON`);
  for (const project of resume.projects) {
    if (project.slug) {
      push(
        `- [${project.name} case study](${base}/projects/${project.slug}): ` +
          project.blurb.replace(/\s+/g, ' ').trim()
      );
    }
  }
  push();

  // ---- experience ----------------------------------------------------------
  push('## Experience');
  push();
  for (const job of resume.work) {
    const range = formatRange(job.startDate, job.endDate);
    push(`### ${job.position}, ${job.company} (${range.display})`);
    if (job.client) push(`Client: ${job.client}`);
    if (job.location) push(`Location: ${job.location}`);
    push();
    if (job.summary) {
      push(job.summary.replace(/\s+/g, ' ').trim());
      push();
    }
    for (const workstream of job.workstreams) {
      push(`#### ${workstream.name}`);
      if (workstream.tech.length > 0) push(`Technologies: ${workstream.tech.join(', ')}`);
      push();
      for (const highlight of workstream.highlights) {
        push(`- ${highlight.replace(/\s+/g, ' ').trim()}`);
      }
      push();
    }
  }

  // ---- skills --------------------------------------------------------------
  push('## Technical Skills');
  push();
  for (const group of resume.skills) {
    push(`- ${group.group}: ${group.keywords.join(', ')}`);
  }
  push();

  // ---- projects ------------------------------------------------------------
  push('## Projects');
  push();
  for (const project of resume.projects) {
    push(`### ${project.name}`);
    push(project.blurb.replace(/\s+/g, ' ').trim());
    if (project.stack.length > 0) push(`Stack: ${project.stack.join(', ')}`);
    for (const highlight of project.highlights) {
      push(`- ${highlight}`);
    }
    const repo = real(project.links?.repo);
    if (repo) push(`- [Repository](${repo})`);
    if (project.slug) push(`- [Case study](${base}/projects/${project.slug})`);
    push();
  }

  // ---- education -----------------------------------------------------------
  push('## Education');
  push();
  for (const entry of resume.education) {
    const range = formatRange(entry.startDate, entry.endDate);
    push(`### ${entry.degree}, ${entry.institution} (${range.display})`);
    if (entry.score) push(`Result: ${entry.score}`);
    for (const award of entry.awards) push(`- ${award}`);
    push();
  }

  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
