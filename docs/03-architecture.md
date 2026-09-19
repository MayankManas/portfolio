# 03 — Architecture

> **Status: built and live at https://mayankmanas.pages.dev.** This document has been updated to
> describe what was actually built. Where the implementation diverged from the original plan, the
> divergence is marked **[changed]** with the reason, because the reasoning is the useful part.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro 7**, `output: 'static'` | Ships zero JS by default. Native MDX. **[changed]** The plan said Astro 5, which was current when this was written; the build uses 7. Same content model, no impact. |
| Styling | **Tailwind v4** | Fast, and theme tokens map cleanly onto the light/dark requirement. |
| Language | **TypeScript, strict** | The schema is the contract; strictness keeps renderers honest. |
| Validation | **Zod**, in `src/lib/schema.ts` | The discriminated union on `layout` *is* the layout registry. **[changed]** The schemas live in a plain module, not `content.config.ts` — see "Why the YAML is not a content collection" below. |
| PDF | **Playwright** print-to-PDF | Produces a real text layer. Runs against the *built* output over a local static server, so what is printed is exactly what deploys. |
| CI | **GitHub Actions** | Free and unlimited on public repos. |
| Hosting | **Cloudflare Pages** | Unlimited bandwidth, free SSL, free custom domain, no non-commercial restriction. |

## Repository layout

```
content/                      # everything the user edits
  resume.yaml                 # canonical facts -> drives site AND pdf
  site.yaml                   # presentation: theme + ordered sections
  projects/
    fileserver.md             # deep case study (frontmatter + prose)
src/                          # the user never opens this
  content.config.ts           # the projects markdown collection, and only that
  lib/
    schema.ts                 # ALL Zod schemas + the layout registry
    content.ts                # loads + validates both YAML files (Vite ?raw, so dev hot-reloads)
    resolveSource.ts          # dotted path -> data, AND proves the shape fits the layout
    crossValidate.ts          # slug <-> markdown file, both directions
    timeline.ts               # normalises work | education into one renderable shape
    jsonld.ts                 # Person schema built from resume.yaml
    formatDate.ts             # -> display string + <time datetime> value
    placeholder.ts            # TODO handling: a placeholder never renders as a real link
    ascii.ts                  # ASCII punctuation for the PDF (see the ATS notes below)
  layouts/
    Base.astro                # head, meta, JSON-LD, OG, theme, nav, footer
    Print.astro               # A4 print shell for /resume
  components/
    sections/
      Prose.astro  Metrics.astro  Timeline.astro  Cards.astro
      Tags.astro   List.astro     Contact.astro
      SectionShell.astro      # the frame every section shares
      index.ts                # layout -> component map
    Hero.astro  Chip.astro  ScrollSpy.astro  ThemeToggle.astro
  pages/
    index.astro               # loops site.sections, dispatches on layout
    projects/[slug].astro
    resume.astro              # noindex; source for the PDF
    api/portfolio.json.ts
    llms.txt.ts
    robots.txt.ts             # generated, not static - see below
    404.astro
  styles/
    tokens.css  global.css  print.css
scripts/
  validate.ts                 # npm run validate
  load-content.ts             # node-side loader; same schemas, no Vite
  static-server.ts            # serves dist/ on localhost for the scripts below
  build-assets.ts             # postbuild: dist/resume.pdf + dist/og.png
  smoke.ts                    # 34 browser assertions against the built site
  screenshots.ts              # regenerates docs/screenshots/
  lighthouse.ts               # audits the built site
.github/workflows/deploy.yml
CONTENT.md                    # the authoring guide
```

## Content model

Two files, split along a clean line: **`resume.yaml` is what is true about him; `site.yaml` is how
the site presents it.** Both are already seeded with real data — read them.

### Why the YAML is not a content collection — **[changed]**

The plan put both YAML files through Astro content collections. Neither is a *collection*: each
is a single config object, so a loader would have to invent synthetic ids for `basics`, `work`,
`skills` and friends and then union their unrelated shapes into one schema. They are loaded and
validated in `src/lib/content.ts` instead, against `src/lib/schema.ts` — the same Zod
guarantees, better errors, and the schemas stay importable by `npm run validate` outside Astro.

`content/projects/*.md` genuinely is a collection of entries and needs Astro's markdown
rendering, so it still uses one. That is all `src/content.config.ts` contains.

The YAML is pulled in with Vite's `?raw`, which keeps the dev server watching both files so a
content edit hot-reloads.

### `resume.yaml` shape

Modeled on [JSON Resume](https://jsonresume.org/schema/) where possible, for portability, with
**one necessary deviation**: his résumé nests *workstreams* under a single employer, so the
structure is three levels deep rather than JSON Resume's flat `work[].highlights[]`:

```
work[]
  └── workstreams[]
        └── highlights[]
```

This matters — it is the correct model for a long tenure with distinct programs of work, and it is
what makes the timeline's progressive disclosure natural. Don't flatten it.

Key fields with special behavior:

| Field | Behavior |
|---|---|
| `work[].endDate: null` | Renders as "Present" |
| `basics.phone` | **[changed]** Public in both the HTML and the PDF. The plan had a `pdf-only` mode; it was dropped because `/resume.pdf` is publicly linked and `robots.txt` deliberately invites AI crawlers, so withholding the number from one of the two surfaces bought nothing. |
| any field set to `TODO` | Treated as missing rather than rendered. A `TODO` URL produces no link instead of a link that 404s, and outstanding ones are listed in a notice on the homepage. |
| `skills[].priority: primary \| secondary` | `primary` groups render expanded on the site; `secondary` collapse behind "show all". All groups always appear in the HTML and in the PDF. |
| `projects[].slug` | **Presence of a slug is what creates a case study page.** Requires a matching `content/projects/<slug>.md`. Absent slug → card only. |
| `work[].client` | Renders as a subtitle under the company |

### `site.yaml` shape

```yaml
theme: { accent: "#2563eb", mode: system }
sections:
  - id: work
    title: Experience
    layout: timeline
    source: work            # a path into resume.yaml
  - id: talks
    title: Talks & Writing
    layout: list
    items: [...]            # or inline items instead of a source
```

Each section supplies **either** `source` (a dotted path into `resume.yaml`) **or** inline `items`.
`index.astro` maps over `sections` and dispatches on `layout`. That single loop is the entire
homepage — there is no per-section markup anywhere in the codebase.

Adding a section = appending to this array. Reordering the site = reordering the array. Hiding a
section = deleting one line.

## The layout registry

`src/content.config.ts` defines a Zod `discriminatedUnion` on `layout`. This object serves three
purposes at once:

1. Validates each layout's item shape
2. Rejects unknown layouts at build time
3. Documents the registry — it is the single place listing what layouts exist

`src/components/sections/index.ts` maps each `layout` value to its component. **Adding a layout
means touching exactly these two files and nothing else.**

## Validation and failure behavior

Build-time checks, each failing with a message naming the offending section `id` or field:

| Condition | Result |
|---|---|
| Unknown `layout` value | Build fails, names the section id and the bad value |
| `source` resolves to nothing | Build fails — names the section, suggests the nearest valid path, lists them all |
| `source` resolves to the **wrong shape** | **[added]** Build fails. `layout: timeline` with `source: skills` is a valid layout and a resolvable path, so nothing else catches it. Each layout declares a schema for the data it consumes. |
| a key left with no value under it | Build fails. YAML turns `links:` with nothing beneath it into `null`, and optional means *absent*, not *null*. |
| `slug` with no matching markdown file | Build fails, names **both** the slug and the expected path |
| Markdown file with no matching project entry | Build fails (orphan case study) |
| Missing required field | Zod error naming the path |
| Empty or absent section items | **Not** an error — section is skipped at render, no placeholder hole |

`npm run validate` runs schema checks alone, fast, without a full build.

### The safety property that matters

**A bad content edit cannot degrade the live site.** The build fails, so the
`wrangler pages deploy` step never runs, and the previous deployment stays live. He sees a red X on
the commit — never a broken homepage. This is why validation strictness is a feature, not a risk.

## Authoring workflow

```
edit content file  →  git commit  →  git push  →  GitHub Actions  →  live in ~2 min
```

No local build step, no deploy command. Two editing paths:

- **Local:** `npm run dev`, hot reload, see it before committing
- **Anywhere, phone included:** open the repo on github.com, press `.` for the web editor, edit,
  commit to `main`

| Edit | Touches |
|---|---|
| New job / education entry | `resume.yaml` → `work` / `education` |
| New workstream or highlight | `resume.yaml` → nested under the employer |
| New skill | `resume.yaml` → a group's `keywords` |
| New project, card only | `resume.yaml` → `projects` |
| New project **with** case study | `resume.yaml` entry + `slug`, **and** `content/projects/<slug>.md` |
| New section, reorder, hide | `site.yaml` → `sections` only |

Branch pushes get Cloudflare preview URLs; `main` is production.

## Deployment pipeline

`.github/workflows/deploy.yml`, on push to `main`:

```
checkout → setup node → npm ci
  → npm run validate          # schema + cross-file, ~1s
  → astro check               # TypeScript, strict
  → playwright install chromium → npm run build   # site + resume.pdf + og.png
  → npm run smoke             # 34 browser assertions, incl. JS-disabled
  → pdftotext check           # the PDF must have an extractable text layer
  → wrangler pages deploy dist
```

**Why the build runs in Actions rather than Cloudflare's own builder:** the PDF step needs headless
Chromium, and Cloudflare Pages' build environment is unreliable for it. Building in Actions and
uploading the finished `dist/` with Wrangler sidesteps that entirely, and keeps one commit → one
deploy.

Secrets needed: `CLOUDFLARE_API_TOKEN` (scoped to Cloudflare Pages: Edit) and
`CLOUDFLARE_ACCOUNT_ID`, both repository secrets.

**Triggers.** `push` to `main` is production. `pull_request` runs the identical gate and also
publishes a Cloudflare preview at `<branch>.mayankmanas.pages.dev`. A branch pushed *without* an
open PR runs nothing — the PR is the review unit.

`npm run verify` runs the same gate locally, in the same order.

## Cost — $0

| Service | Free tier | Actual usage |
|---|---|---|
| GitHub Actions | **Unlimited** minutes on public repos (private: 2,000 min/month) | ~1–2 min per content push |
| Cloudflare Pages | Unlimited bandwidth and requests, free SSL, free custom domain | Serving static files |
| `*.pages.dev` subdomain | Free | Works immediately |

Make the repo **public** — Actions minutes become unlimited, and a recruiter reading clean,
well-structured source is itself a hiring signal.

**Live on `https://mayankmanas.pages.dev`.** Actual spend so far: $0.

Only optional spend: a custom domain, ~$10/year at Cloudflare Registrar (at-cost). It can be
attached later with no code change — only `meta.url` in `site.yaml` would move.

*(Free-tier figures were current as of planning; verify if they look off.)*

**One note on creating the project.** Cloudflare is folding Pages into Workers, and the dashboard
no longer offers a "create Pages project" button in the obvious place. Worse,
`wrangler pages project create` silently delegates to a Workers migration flow that rewrites
`astro.config.mjs` to add an SSR adapter — which would break the static-output decision above.
The project here was created with `--force`, which bypasses that. This only matters once.
