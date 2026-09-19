/**
 * /api/portfolio.json - the whole resume as one structured document.
 *
 * Advertised in <head> via <link rel="alternate">, so a crawler that prefers
 * data over markup can find it without guessing. Prerendered to a static file
 * like everything else; there is no server.
 */
import type { APIRoute } from 'astro';
import { getResume, getSite } from '../../lib/content';
import { real } from '../../lib/placeholder';

export const prerender = true;

export const GET: APIRoute = () => {
  const resume = getResume();
  const site = getSite();
  const base = site.meta.url.replace(/\/$/, '');

  const payload = {
    $schema: 'https://jsonresume.org/schema/',
    generatedAt: new Date().toISOString(),
    basics: {
      name: resume.basics.name,
      label: resume.basics.label,
      headline: resume.basics.headline,
      email: resume.basics.email,
      phone: real(resume.basics.phone) ?? null,
      availability: resume.basics.availability ?? null,
      location: {
        city: real(resume.basics.location.city) ?? null,
        region: real(resume.basics.location.region) ?? null,
        country: resume.basics.location.country,
      },
      url: base,
      profiles: resume.basics.profiles
        .filter((profile) => real(profile.url) !== undefined)
        .map((profile) => ({
          network: profile.network,
          username: real(profile.username) ?? null,
          url: profile.url,
        })),
    },
    // The three-level nesting is preserved rather than flattened: it is the
    // accurate shape of the work, and a consumer can flatten it if it wants.
    work: resume.work,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects.map((project) => ({
      ...project,
      caseStudy: project.slug ? `${base}/projects/${project.slug}` : null,
      links: {
        repo: real(project.links?.repo) ?? null,
        demo: real(project.links?.demo) ?? null,
      },
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
