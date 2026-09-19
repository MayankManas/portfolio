/**
 * jsonld.ts - schema.org Person, built from resume.yaml.
 *
 * Generated rather than hand-written so it can never drift from what is
 * visible on the page. Structured data that contradicts the page is worse than
 * none at all: it is the version a machine trusts.
 *
 * Placeholder (TODO) values are omitted rather than emitted, because a
 * sameAs pointing at the literal string "TODO" is actively misleading.
 */
import type { Resume } from './schema';
import { real } from './placeholder';

export function buildPersonJsonLd(resume: Resume, siteUrl: string): Record<string, unknown> {
  const { basics, work, education, skills, projects } = resume;

  const current = work[0];
  const locality = real(basics.location.city);
  const region = real(basics.location.region);

  const sameAs = basics.profiles
    .map((profile) => real(profile.url))
    .filter((url): url is string => url !== undefined);

  // Every keyword across every group - this is the field an LLM asked "what
  // does this person know" is most likely to read.
  const knowsAbout = skills.flatMap((group) => group.keywords);

  const person: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: basics.name,
    jobTitle: current?.position ?? basics.label,
    description: basics.headline,
    email: `mailto:${basics.email}`,
    url: siteUrl,
    knowsAbout,
  };

  const telephone = real(basics.phone);
  if (telephone) person.telephone = telephone;
  if (sameAs.length > 0) person.sameAs = sameAs;

  person.address = {
    '@type': 'PostalAddress',
    addressCountry: basics.location.country,
    ...(locality ? { addressLocality: locality } : {}),
    ...(region ? { addressRegion: region } : {}),
  };

  if (current) {
    person.worksFor = {
      '@type': 'Organization',
      name: current.company,
    };

    person.hasOccupation = {
      '@type': 'Occupation',
      name: current.position,
      occupationLocation: {
        '@type': 'Country',
        name: current.location ?? basics.location.country,
      },
      skills: knowsAbout.join(', '),
    };
  }

  if (education.length > 0) {
    person.alumniOf = education.map((entry) => ({
      '@type': 'EducationalOrganization',
      name: entry.institution,
    }));
  }

  if (projects.length > 0) {
    person.subjectOf = projects.map((project) => ({
      '@type': 'CreativeWork',
      name: project.name,
      abstract: project.blurb,
      ...(project.slug ? { url: `${siteUrl.replace(/\/$/, '')}/projects/${project.slug}` } : {}),
      ...(real(project.links?.repo) ? { codeRepository: real(project.links?.repo) } : {}),
    }));
  }

  return person;
}
