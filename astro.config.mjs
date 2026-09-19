// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { parse } from 'yaml';

// The canonical URL lives in content/site.yaml alongside everything else the
// user edits, so it is read from there rather than duplicated here.
const site = parse(readFileSync('./content/site.yaml', 'utf8'));

export default defineConfig({
  output: 'static',
  site: site.meta.url,
  integrations: [
    mdx(),
    sitemap({
      // /resume is the print source for the PDF and carries noindex. Listing
      // it in the sitemap while telling crawlers not to index it is a
      // contradiction, and a second HTML copy of the resume would compete
      // with the homepage in search results.
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return path !== '/resume';
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
