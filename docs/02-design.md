# 02 — Design

> **Status: built and live at https://mayankmanas.pages.dev.** Lighthouse scores 100 across
> Performance, Accessibility, Best Practices, SEO and Agentic Browsing on both `/` and the case
> study. Divergences from this document are marked **[changed]**.

## What the site argues

One claim, stated in the hero and evidenced by everything below it:

> **"I build and operate backend infrastructure for enterprise security products — and I automate
> the engineering around it."**

His differentiator is *not* "Java + Spring" — every SDE-2 has that. It is the pairing of:

1. **Release and compatibility infrastructure at real scale** — ~300 OS/DB combinations, ~10,000
   configuration permutations, ~700 test environments per release, a 28-day release cycle, a
   platform used by ~40 engineers across 3 teams.
2. **Production AI-agent work** — Google ADK + Amazon Bedrock agents, vendor-documentation crawling
   with browser automation, human-in-the-loop safeguards before any data mutation.

Very few backend engineers have shipped both. The design must make that pairing impossible to miss.

## Information architecture

Single scrolling homepage. Subpages only for long-form content.

| Route | Purpose |
|---|---|
| `/` | About → Impact → Experience → Projects → Skills → Education → Contact |
| `/projects/fileserver` | Deep case study |
| `/resume` | Print-styled, `noindex`. The PDF's source. |
| `/resume.pdf` | Generated every build |
| `/api/portfolio.json` | Static structured endpoint |
| `/llms.txt` | LLM-readable summary |
| `/404` | — |

**Above the fold:** name, the one-line claim, location + "open to", and exactly four links —
GitHub, LinkedIn, Résumé PDF, email. Nothing competes with those.

**Projects sit below Experience.** At 5 YOE the job history is the evidence and side projects are
the supporting exhibit. Inverting that reads junior.

## Visual direction — technical editorial

Typographic and dense. Left-aligned. Monospace for dates and metadata. One accent color used
confidently. Generous whitespace. No stock imagery, no photo, no decorative illustration. The page
should read like well-set engineering documentation.

This is the register that suits a backend/infrastructure SDE-2, and it is the direction that is
*inherently* most parseable, because its visual interest comes from type and rhythm rather than
chrome or decorative text.

### Kept from being bland by

- A strong typographic scale — real size contrast between section headers, entry titles and body
- One accent color applied with conviction (metric figures, hairline rules, link underlines, focus rings)
- **Experience rendered as a vertical spine** threading company → workstreams, with the
  ~300 / ~10,000 / ~700 figures pulled out as inline callouts rather than buried in bullet prose
- **Metric counters that count up** when scrolled into view, animating real text nodes. They render at their final value server-side, so they are correct with JS off, and land byte-identical on the last frame.
- Skill chips stagger-fading in per group
- A sticky scroll-spy nav on desktop showing position in the page
- A reading-progress bar on case study pages
- Accent hairlines as section dividers instead of heavy header blocks
- Light and dark themes via `prefers-color-scheme` plus a `data-theme` toggle

### Non-negotiables on the motion

- Everything behind `prefers-reduced-motion`
- The page must be **fully readable with JS disabled** — motion is enhancement only
- Target Lighthouse ≥95 on Performance, Accessibility, Best Practices and SEO

## Layout catalogue

Seven layouts cover every section he is plausibly going to add. Only a genuinely new *visual
treatment* requires code.

| `layout` | Renders | Typical source |
|---|---|---|
| `prose` | A markdown block | `basics.headline` |
| `metrics` | Large figures with muted labels; counts up on scroll | inline `items` |
| `timeline` | Spine-threaded entries: org + dates, client subtitle, nested workstreams, highlights with progressive disclosure | `work`, `education` |
| `cards` | Grid. A `slug` on the item turns the card into a case-study link | `projects` |
| `tags` | Labeled rows of chips. **No percentage bars** — "React 85%" is meaningless | `skills` |
| `list` | Label + meta + optional href | inline `items` |
| `contact` | Row of links | `basics.profiles` |

### Section-specific notes

**`metrics` is his strongest section.** Five figures of pure quantified impact, straight from his
résumé. It sits second, right after the headline, because it is the fastest possible proof.

**`timeline` needs the progressive disclosure.** One employer, 8 workstreams, ~21 bullets. Render
workstream name + tech chips + top 2 highlights, with a "show all" toggle. See the CSS-only
constraint in the machine-readability section — this is the single easiest thing to get wrong.

**`tags` — 13 skill groups is visual noise.** Use the `priority` field: `primary` groups render
expanded, `secondary` groups collapse behind the same "show all" affordance. All 13 always ship in
the HTML and in the PDF. This avoids per-item curation churn while keeping the page calm.

## Machine-readability specification

This is a first-class requirement, not an afterthought. Build it in deliberately.

### 1. All content in server-rendered HTML

Astro static output gives this by default — but it is defeated by careless component design.
Nothing may require JS to become readable.

**The critical case:** collapsed experience bullets and secondary skill groups must be **present in
the HTML and hidden with CSS** (`max-height`/`overflow`, or a `<details>` element). They must never
be conditionally rendered in JS. Scrapers must receive all ~21 highlights.

`<details>`/`<summary>` is the preferred mechanism: content is in the DOM, it is keyboard
accessible and screen-reader friendly for free, and it works with JS disabled.

### 2. JSON-LD `Person` schema

Generated from `content/resume.yaml` so it can never drift from the visible content. Include
`name`, `jobTitle`, `email`, `url`, `sameAs` (profiles), `worksFor`, `alumniOf`, `knowsAbout`
(skills), `hasOccupation`.

### 3. Structured endpoints

- `/api/portfolio.json` — the resolved content as JSON, advertised in `<head>` via
  `<link rel="alternate" type="application/json">`
- `/llms.txt` — clean prose summary plus links, generated from the YAML

### 4. Crawler permissions

`robots.txt` must **explicitly allow** the AI crawlers: `GPTBot`, `ClaudeBot`, `PerplexityBot`,
`Google-Extended`, `CCBot`. Many templates and hosts block these by default; here the opposite is
wanted.

### 5. Semantic markup

- `<article>` per experience entry and project
- `<time datetime="2021-07">` for every date — machine-readable, not just formatted text
- Strict `h1 → h2 → h3` hierarchy, no skipped levels, no headings chosen for size
- `<dl>` for the metrics section
- Email as an unobfuscated `mailto:` link, **with the address as the link text** — an address that lives only in an `href` does not survive tag-stripping. **[changed]** Phone is public in both the HTML and the PDF; the `pdf-only` mode was dropped (see `01-requirements.md`).
- `sitemap.xml`, `<meta name="description">`, OG and Twitter tags, an OG image

### 6. No text in images

No text inside `<img>`, SVG `<text>`, or canvas — anywhere. The animated metric counters animate
text nodes.

### 7. ATS-safe PDF

The `/resume` print route is deliberately plainer than the website:

- Single column. ATS parsers mangle multi-column layouts.
- Conventional section headings: `WORK EXPERIENCE`, `EDUCATION`, `TECHNICAL SKILLS`, `PROJECTS`
- A real, selectable text layer (Playwright print-to-PDF provides this; an image-based PDF is a
  total failure)
- No icon fonts, no tables used for layout, no decorative glyphs
- All 21 highlights and all 13 skill groups — nothing collapsed
- Phone number included. **[changed]** It is also in the public HTML — see `01-requirements.md`.
- **[added]** All text is forced to ASCII punctuation on the print route. A middot and en dash
  extracted as U+FFFD, so the contact line came out as "India <?> email <?> phone". Separately,
  `letter-spacing` on the section headings made `pdftotext` read "EDUCATION" as "E D U C AT I O N",
  so an ATS searching for the literal heading found nothing. Both are fixed; both were only
  visible by actually extracting the text.

### Verification

See the scrapability check in `04-implementation-plan.md` — `curl` the built HTML with no JS and
confirm every bullet is present; validate the JSON-LD; extract the PDF text layer with `pdftotext`
and confirm clean, ordered output.
