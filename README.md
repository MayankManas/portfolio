# Portfolio — Mayank Manas

Personal portfolio site for an active job hunt. Backend SDE-2, 5+ YOE, Java / Spring Boot / AWS.

**Live: https://mayankmanas.pages.dev**

[![Deploy](https://github.com/MayankManas/portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/MayankManas/portfolio/actions/workflows/deploy.yml)

## The idea in one paragraph

The site is driven entirely by two YAML files. `content/resume.yaml` holds the facts;
`content/site.yaml` holds an ordered list of sections, each declaring a layout from a small
registry. The homepage is a single loop that dispatches on that layout, so adding a job, a skill,
a project — or an entirely new section — is a content edit, never a code change. The same data
generates both the website and an ATS-safe résumé PDF. Push to `main` and GitHub Actions
validates, builds, regenerates the PDF, and deploys to Cloudflare Pages in about two minutes.
Total cost: $0.

## Editing the site

**You almost certainly want [CONTENT.md](CONTENT.md)** — the authoring guide. Recipes for every
kind of edit, the field reference, the layout catalogue with screenshots, how to edit from your
phone, and what to do when something breaks.

The short version:

```bash
npm install          # first time only

npm run validate     # ~1s   — after any YAML edit
npm run dev          #       — see it at http://localhost:4321, hot reloads
npm run verify       # ~1min — the full CI gate; if this passes, the push will not fail
```

Then commit and push to `main`, or open a PR. Either way CI validates before anything deploys.

## What's here

```
content/                     everything you edit
  resume.yaml                the facts — drives the site AND the PDF
  site.yaml                  presentation — theme + the ordered section list
  projects/fileserver.md     the flagship case study

src/                         you should never need to open this
  lib/schema.ts              all Zod schemas + THE LAYOUT REGISTRY
  lib/resolveSource.ts       dotted path -> data, and proves the shape matches the layout
  lib/content.ts             loads + validates both YAML files
  components/sections/       the seven layout renderers + index.ts (layout -> component)
  pages/index.astro          one loop over site.sections; no per-section markup anywhere
  pages/resume.astro         the print source for resume.pdf
  pages/robots.txt.ts        generated, so the sitemap URL can never drift
  pages/llms.txt.ts          LLM-readable summary, generated
  pages/api/portfolio.json.ts

scripts/
  validate.ts                npm run validate
  build-assets.ts            postbuild: resume.pdf + og.png via Playwright
  smoke.ts                   34 browser checks incl. "works with JS disabled"
  screenshots.ts             regenerates docs/screenshots/ for CONTENT.md
  lighthouse.ts              audits the built site

docs/                        design and architecture record (see the note below)
CONTENT.md                   the authoring guide — start here
.github/workflows/deploy.yml validate -> check -> build -> smoke -> deploy
```

## Routes

| Route | What it is |
|---|---|
| `/` | The homepage |
| `/projects/fileserver` | Case study |
| `/resume.pdf` | Generated every build. Real text layer, ATS-safe, 3 pages. |
| `/resume` | The print source. `noindex`, excluded from the sitemap. |
| `/api/portfolio.json` | The whole résumé as structured JSON |
| `/llms.txt` | Clean prose summary for language models |
| `/robots.txt` | Explicitly allows AI crawlers — that is deliberate |

## The two rules

1. **Content and code are separate artifacts.** If changing what the site displays requires
   editing anything in `src/`, the design has failed. The one deliberate exception is the résumé
   PDF's section order, which is fixed for ATS compatibility — see the end of CONTENT.md.
2. **Everything must be machine-readable.** Companies screen with AI before a human reads
   anything. All content ships in the server-rendered HTML; collapsed content is hidden with CSS,
   never conditionally rendered. All 21 experience highlights are in the markup whether or not
   they are visible.

## Quality gates

Enforced in CI on every push and every PR:

- `npm run validate` — schema + cross-file checks, ~1s
- `astro check` — TypeScript, strict
- build, including the PDF and OG image
- `npm run smoke` — 34 browser assertions, including that all 21 highlights and all 13 skill
  groups are present **with JavaScript disabled**
- the PDF is checked for an extractable text layer

Measured locally and not currently gated in CI: Lighthouse scores **100 / 100 / 100 / 100 / 100**
(Performance, Accessibility, Best Practices, SEO, Agentic Browsing) on both `/` and the case
study. Run `npm run lighthouse` to reproduce.

## A note on `docs/`

`docs/01` through `docs/04` were written before the build, as the design record. They have been
updated where they described something that is no longer true, and each carries a status note at
the top. Where the implementation deliberately diverged from the plan, the divergence and its
reason are recorded in place rather than edited out — the reasoning is the useful part.

## Still open

- **FileServer's repository link** is deliberately withheld for now; the case study stays.
- **A custom domain** (~$10/yr) remains optional and deferred. The site runs on `*.pages.dev`,
  and a domain can be attached later with no code change.
- **Adding FileServer to the résumé** — it is the strongest publicly discussable project and
  `/resume.pdf` is now the canonical résumé.
