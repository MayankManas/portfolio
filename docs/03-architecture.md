# 03 — Architecture

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro 5**, `output: 'static'` | Content collections validate with Zod natively, so "bad content fails the build with a readable error" needs no custom tooling. Ships zero JS by default. Native MDX. |
| Styling | **Tailwind v4** | Fast, and theme tokens map cleanly onto the light/dark requirement. |
| Language | **TypeScript, strict** | The schema is the contract; strictness keeps renderers honest. |
| Validation | **Zod** via `content.config.ts` | The discriminated union on `layout` *is* the layout registry. |
| PDF | **Playwright** print-to-PDF | Produces a real text layer. Reuses the site's own CSS, so one source truly drives both outputs. |
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
  content.config.ts           # Zod schemas = validation + layout registry
  lib/
    resolveSource.ts          # "work" | "basics.headline" -> data; throws if unresolvable
    jsonld.ts                 # Person schema built from resume.yaml
    formatDate.ts             # -> display string + <time datetime> value
  layouts/
    Base.astro                # head, meta, JSON-LD, theme, nav, footer
    Print.astro               # A4 print shell for /resume
  components/
    sections/
      Prose.astro  Metrics.astro  Timeline.astro  Cards.astro
      Tags.astro   List.astro     Contact.astro
      index.ts                # layout -> component map
    Chip.astro  ScrollSpy.astro  ThemeToggle.astro  CountUp.astro
  pages/
    index.astro               # loops site.sections, dispatches on layout
    projects/[slug].astro
    resume.astro              # noindex; source for the PDF
    api/portfolio.json.ts
    llms.txt.ts
    404.astro
  styles/
    tokens.css  print.css
scripts/
  resume-pdf.mjs              # /resume -> dist/resume.pdf
public/
  robots.txt                  # explicitly allows AI crawlers
.github/workflows/deploy.yml
CONTENT.md                    # the authoring guide
```

## Content model

Two files, split along a clean line: **`resume.yaml` is what is true about him; `site.yaml` is how
the site presents it.** Both are already seeded with real data — read them.

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
| `basics.phoneVisibility: pdf-only` | Present in the PDF, never emitted into public HTML |
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
| `source` resolves to nothing | Build fails — catches typos like `resume.works` |
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
checkout → setup node → npm ci → npm run validate → astro build
  → install playwright chromium → node scripts/resume-pdf.mjs
  → wrangler pages deploy dist
```

**Why the build runs in Actions rather than Cloudflare's own builder:** the PDF step needs headless
Chromium, and Cloudflare Pages' build environment is unreliable for it. Building in Actions and
uploading the finished `dist/` with Wrangler sidesteps that entirely, and keeps one commit → one
deploy.

Secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Cost — $0

| Service | Free tier | Actual usage |
|---|---|---|
| GitHub Actions | **Unlimited** minutes on public repos (private: 2,000 min/month) | ~1–2 min per content push |
| Cloudflare Pages | Unlimited bandwidth and requests, free SSL, free custom domain | Serving static files |
| `*.pages.dev` subdomain | Free | Works immediately |

Make the repo **public** — Actions minutes become unlimited, and a recruiter reading clean,
well-structured source is itself a hiring signal.

Only optional spend: a custom domain, ~$10/year at Cloudflare Registrar (at-cost). Skipping it
means shipping on `mayankmanas.pages.dev`, and the domain can be attached later with no code
changes. *(Free-tier figures are current as of planning; verify if they look off.)*
