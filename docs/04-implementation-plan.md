# 04 — Implementation Plan

Build in this order. Each phase leaves the repo in a working state.

---

## Phase 1 — Scaffold

```bash
npm create astro@latest . -- --template minimal --typescript strict
npx astro add tailwind mdx sitemap
npm i -D yaml playwright
```

- `astro.config.mjs`: `output: 'static'`, site URL set
- `src/styles/tokens.css`: color/type/space tokens; light palette on bare `:root`, dark overrides
  under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, plus
  `:root[data-theme="dark"]` so the toggle wins both ways
- `src/layouts/Base.astro`: head, meta, theme toggle, skip link, footer
- Type scale with real contrast — this carries the whole design (see `02-design.md`)

**Done when:** a blank themed page renders in both themes and Lighthouse is ≥95.

---

## Phase 2 — Content model

The core of the project. Get this right and the rest is mechanical.

- `src/content.config.ts`:
  - `resume` schema — three-level `work[] → workstreams[] → highlights[]` nesting,
    `endDate: z.string().nullable()`, `phoneVisibility`, `skills[].priority`, `projects[].slug`
  - `site` schema — `sections` as a `z.discriminatedUnion('layout', [...])` covering all seven
    layouts. **This union is the layout registry.**
  - `projects` markdown collection — frontmatter: `title`, `summary`, `stack`, `published`, `role`
- `src/lib/resolveSource.ts` — dotted path → data, throwing a message naming the section id when
  unresolvable
- `src/lib/formatDate.ts` — returns both a display string and the `datetime` attribute value
- Cross-validation: every `slug` has a markdown file and vice versa
- `npm run validate` script

Content is **already seeded** in `content/resume.yaml` and `content/site.yaml` — read them; do not
re-transcribe the résumé.

**Done when:** `npm run validate` passes on the seeded content, and each failure case in
`03-architecture.md` produces a readable error naming the right section.

---

## Phase 3 — Section renderers

Seven components in `src/components/sections/`, plus `index.ts` mapping `layout` → component.

`src/pages/index.astro` is a single loop over `site.sections` dispatching on `layout`. **No
per-section markup anywhere.** If you find yourself writing `{section.id === 'work' && ...}`, the
design has failed.

Per-layout notes:

- **`Timeline`** — the hard one. Vertical spine (CSS pseudo-element), company header with dates
  right-aligned, client as subtitle, workstreams nested with tech chips. Top 2 highlights visible;
  the rest inside `<details>`. **All highlights in the DOM** — see the CSS-only constraint in
  `02-design.md`.
- **`Metrics`** — `<dl>`, large accent figures, `CountUp` on scroll via `IntersectionObserver`,
  animating text nodes. Renders final values server-side so it is correct with JS off.
- **`Cards`** — `slug` present → "Read case study →" link; absent → repo link only
- **`Tags`** — `primary` groups expanded, `secondary` in `<details>`. No percentage bars.
- **`Prose`**, **`List`**, **`Contact`** — straightforward

Also: `ScrollSpy` sticky nav (desktop only), stagger-fade on chips, all motion behind
`prefers-reduced-motion`.

**Done when:** the homepage renders the full seeded content correctly at 375px and on desktop, in
both themes, and is completely readable with JS disabled.

---

## Phase 4 — Case study

- `src/pages/projects/[slug].astro` — reading-progress bar, prose typography, back link
- Write `content/projects/fileserver.md`. Source material: `../FileServer/README.md` and
  `../FileServer/ARCHITECTURE.md`. Read both.

Structure it **problem → constraints → decisions that mattered → outcome → what I'd change**. The
"decisions" section is what hiring managers actually read; it is the only thing separating him from
someone who followed a tutorial.

Real material available: streaming I/O for files up to 100GB without buffering, path-traversal
protection, bcrypt credential validation, RFC1918 IP whitelisting, HTTPS with self-signed cert
generation, Winston structured JSON logging with rotation, rate limiting, jest + supertest
coverage, a concurrency smoke test, and a pre-development architecture document with an explicit
extensibility story (middleware patterns for future auth schemes and storage backends).

**Done when:** `/projects/fileserver` reads as a substantive engineering write-up, and the
FileServer card links to it.

---

## Phase 5 — Machine-readability

Implement everything in the machine-readability section of `02-design.md`:

- `src/lib/jsonld.ts` → `Person` schema from `resume.yaml`, injected in `Base.astro`
- `src/pages/api/portfolio.json.ts` + `<link rel="alternate">` in head
- `src/pages/llms.txt.ts`
- `public/robots.txt` explicitly allowing `GPTBot`, `ClaudeBot`, `PerplexityBot`,
  `Google-Extended`, `CCBot`
- Semantic audit: `<article>`, `<time datetime>`, strict heading hierarchy, `<dl>` for metrics,
  unobfuscated `mailto:`
- Sitemap, meta description, OG/Twitter tags, OG image

**Done when:** the scrapability check in Verification passes.

---

## Phase 6 — Résumé PDF

- `src/pages/resume.astro` with `Print.astro` shell and `src/styles/print.css`
  (`@page { size: A4; margin: 14mm }`), `noindex`
- ATS-safe: single column, conventional headings, no icon fonts, no layout tables, **all** 21
  highlights and **all** 13 skill groups expanded, phone included
- `scripts/resume-pdf.mjs`: Playwright loads the built `/resume`, prints to `dist/resume.pdf`
- Wire as a postbuild step

**Done when:** `pdftotext dist/resume.pdf -` emits clean, correctly-ordered text, and the PDF fits
sensibly on the page.

---

## Phase 7 — `CONTENT.md`

Written **last**, against the real schema, with real screenshots. Contents:

1. **The 60-second version** — edit → commit → push → live in ~2 min
2. **Recipes**, copy-pasteable: add a job · add a workstream · add a highlight · add a skill · add a
   project card · add a project *with* case study · add a brand-new section · reorder sections ·
   hide something
3. **Field reference** — every field, which are required, what `null` means, what `pdf-only` does,
   what `priority` does
4. **Layout catalogue** — all seven types, each with a screenshot and the YAML that produced it
5. **Editing from your phone** — the `.`-key GitHub web editor flow
6. **When it breaks** — the three errors he will actually hit and the fix for each
7. **The rule** — *if you are opening anything in `src/`, stop.* Either it is a content edit, or it
   is a genuinely new layout.

---

## Phase 8 — Deploy

`.github/workflows/deploy.yml` on push to `main`:

```
npm ci → npm run validate → astro build → playwright install chromium
  → node scripts/resume-pdf.mjs → wrangler pages deploy dist
```

Repo **public**. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Ship on `*.pages.dev`;
custom domain deferred.

**Done when:** a content-only commit goes live in ~2 minutes, and a deliberately broken commit
fails the build *without* touching the live site.

---

## Phase 9 — Optional, post-launch

Build-time enrichment fetching GitHub stars/activity with hardcoded fallbacks, so project metrics
stay current with zero edits. Deliberately last — a nice-to-have that must not delay launch.

---

# Verification

The acceptance test **is** the requirement. Content-only edits must work end to end.

### 1. New section, zero code
Add to `site.yaml`:
```yaml
  - id: talks
    title: Talks & Writing
    layout: list
    items:
      - { label: "Designing compatibility matrices that don't rot", meta: "JUG Delhi · Nov 2026" }
```
→ renders in the right position, styled consistently, **with no file under `src/` touched.**

### 2. New item
Add a workstream to `work` and a project to `projects` → both appear. The project links to a deep
page only if it declares a `slug`.

### 3. Fail loudly
Set `layout: timelime` and `source: resume.works` → `npm run validate` exits non-zero naming both
offending section ids.

### 4. Empty section
Empty a section's items → it vanishes cleanly. No heading, no gap.

### 5. One source, two outputs
Edit a job title → after build it changes on `/` **and** in `dist/resume.pdf`.

### 6. Scrapability — the key check
- `curl` the built `index.html`, JS disabled: confirm **all ~21 highlights** are present in the
  markup, including collapsed ones, and all 13 skill groups
- Validate the JSON-LD in Google's Rich Results test
- Confirm `/api/portfolio.json` and `/llms.txt` resolve and are accurate
- `pdftotext dist/resume.pdf -` → headings and bullets clean and in order
- Confirm `robots.txt` allows the AI crawlers

### 7. Quality gates
Lighthouse ≥95 on all four categories. Verify at 375px, keyboard-only, in both themes, and with JS
disabled.

### 8. Full loop
Push a content-only commit → Actions green → live site and `/resume.pdf` both updated within ~2
minutes.
