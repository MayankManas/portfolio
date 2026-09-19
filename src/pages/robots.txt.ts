/**
 * /robots.txt - generated, not static.
 *
 * It was a hand-written file in public/ until the site got a real URL and the
 * Sitemap line silently kept pointing at the old placeholder. Anything
 * containing the site URL has to be generated from site.yaml, or it drifts the
 * moment the URL changes - which is the whole failure mode this project exists
 * to prevent.
 *
 * AI crawlers are explicitly ALLOWED. Many hosts and templates block these by
 * default; here the opposite is wanted. Companies screen candidates with AI
 * before a human reads anything, so being readable by these agents is the
 * point of the site, not a risk to it.
 */
import type { APIRoute } from 'astro';
import { getSite } from '../lib/content';

export const prerender = true;

/** Agents that train on, or answer questions from, crawled pages. */
const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
  'Bytespider',
  'Meta-ExternalAgent',
  'cohere-ai',
];

/** Conventional search engines. */
const SEARCH_CRAWLERS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Slurp'];

export const GET: APIRoute = () => {
  const site = getSite();
  const base = site.meta.url.replace(/\/$/, '');

  const lines: string[] = [
    '# Every crawler is welcome here, AI agents included.',
    '#',
    '# This is deliberate and the opposite of most templates. The site exists to',
    '# be read by automated screening before a human ever sees it, so the',
    '# machine-readable surfaces below are the point, not a leak.',
    '#',
    `# Structured data: ${base}/api/portfolio.json`,
    `# Plain-text summary: ${base}/llms.txt`,
    '',
  ];

  for (const agent of [...AI_CRAWLERS, ...SEARCH_CRAWLERS]) {
    lines.push(`User-agent: ${agent}`, 'Allow: /', '');
  }

  lines.push(
    '# Everything else',
    'User-agent: *',
    'Allow: /',
    '',
    '# /resume is the print source for the PDF and is noindex; the PDF itself is',
    '# public and meant to be read.',
    `Sitemap: ${base}/sitemap-index.xml`,
    ''
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
