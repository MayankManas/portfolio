# 01 — Requirements & Settled Decisions

## Why this project exists

Mayank is job hunting as a Backend SDE-2 (5+ YOE, Java / Spring Boot / AWS, infrastructure
engineering). He needs a portfolio site, but the problem he actually wants solved is **maintenance**,
not aesthetics.

In his words:

> "Portfolio is something that will keep changing — my experience will continue to grow along with
> my techstack and projects and I don't want to come back and alter what is shown every time I work
> on something and add it to my resume."

Most hand-rolled portfolios hardcode content into components. Every résumé update then becomes a
development task, so the site goes stale within months. That is the failure mode this design exists
to prevent.

## The primary requirement

> **Content and code are separate artifacts.** Adding a job, workstream, skill, project — or an
> entirely new section — is a content edit to a data file. The renderer is generic. Markup is never
> touched.

## The second requirement (surfaced during planning)

> **The site must be aggressively machine-readable.**

In his words:

> "It should be AI scrappable. I don't want to build something that AIs can't scrape since companies
> are using AI's to scour for resumes/details on candidates and manual reading/findings has decreased
> fairly. This doesn't mean that it should totally be in a state that a real person feels bored while
> going through it."

So extraction quality is a primary design input, *and* the page must stay engaging for humans.
Note that machine-readability is an **architecture** property, not a visual style — the two are
independent, and both must be satisfied. Spec in `02-design.md`.

## Settled decisions

Each of these was explicitly chosen by the user. Do not revisit them without asking.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | How content reaches production | **Commit → GitHub Actions → deploy (~2 min).** Fully static output. | Solves the stated pain completely with no server, no cold starts, best SEO, free forever. A real backend was considered and rejected: free tiers sleep, and a 30–50s cold start on a recruiter's first visit is the worst possible case. |
| 2 | How far "never touch code" extends | **Generic section registry.** Sections are an ordered array; each declares a `layout` from a small registry. Adding a whole new section of an existing layout needs zero code. | Fixed sections would cover ~95% of edits but still require code for a new section type. Fully schemaless was rejected as building a CMS. |
| 3 | Résumé | **One source generates both the website and `/resume.pdf`.** | He said the résumé is the thing that keeps changing. Two sources would recreate the double-maintenance problem exactly. |
| 4 | Case study depth | **Markdown file per flagship project**; lesser projects are data-only cards. | Structured fields alone read thin for work worth explaining. |
| 5 | Experience density | **Progressive disclosure** — workstream name + tech + top 2 highlights, with "show all" to expand. | His experience is 8 workstreams / ~21 bullets under one employer: correct for a PDF, a wall of text on screen. **Must be CSS-hidden, not JS-conditional**, so scrapers still receive every bullet. |
| 6 | Visual direction | **Technical editorial** — typographic, one accent color, no stock imagery; interest from type, rhythm and restrained motion. | He asked for "professional but not too bland" plus scrapability. This direction's interest comes from typography rather than chrome, so it satisfies both. The terminal/systems direction was rejected on his own criterion: decorative prompt text (`~/mayank $ cat headline.txt`) pollutes extracted text, so an LLM summarizing the page ingests shell noise alongside real credentials. |
| 7 | Cost | **$0 for hosting, building and deploying.** | Explicit constraint. Public repo → unlimited Actions minutes; Cloudflare Pages free tier. Custom domain (~$10/yr) optional and deferred; ships on `*.pages.dev`. |
| 8 | Authoring guide | **`CONTENT.md` committed to the repo.** | Explicitly requested, so he has a reference when editing months later. |

## Scope

### In

- Static site, single scrolling homepage + case study subpages
- Two YAML content files driving everything
- Generated ATS-safe résumé PDF at a stable URL
- Machine-readable endpoints: `/api/portfolio.json`, `/llms.txt`, JSON-LD
- `CONTENT.md` authoring guide
- CI pipeline: validate → build → generate PDF → deploy

### Out (agreed)

Admin UI · CMS · authentication · database · comments · analytics dashboard · blog engine.

All of these are how a weekend project becomes a six-week project that never ships.

### Project inventory — corrected during planning

| Project | Treatment | Why |
|---|---|---|
| **FileServer** | **Flagship. Deep case study.** | Actively developed. Demonstrates the *same* discipline as his day job — streaming I/O to 100GB, path-traversal protection, bcrypt, IP whitelisting, Winston structured logging, jest + supertest, load/concurrency smoke test, a real pre-development `ARCHITECTURE.md`. Since his professional work is client-confidential, FileServer is the publicly-discussable proof of those skills. |
| BFS/DFS Visualizer | Card only | On his résumé; fine as a minor datapoint. |
| Exercise-tracker | Card only | A MERN datapoint; doesn't earn a case study. |
| **ApplyPilot** | **Excluded entirely** | **Not his project.** A third-party tool he uses to search and apply for jobs. Must not appear on the site. |
| multithreading-exercises | Dropped | Student-tier; dilutes a 5-YOE profile. |
| card-game | Dropped | Same. |

### Confidentiality

His work is for Thales Cybersecurity / Imperva. A public website is more exposed than a résumé
handed to a recruiter. The site stays at exactly the abstraction level his own résumé already uses
and goes no deeper. He was advised to review this before launch.

## Open items for him to fill in

- **Location** — his résumé says only "India". `content/resume.yaml` has a `TODO`.
- **LinkedIn URL** — `TODO` in `content/resume.yaml`.
- **"Open to" line** — what roles/arrangement he wants stated above the fold.
- **Whether to add FileServer to his actual résumé PDF** — it's currently missing from it, and it's
  his strongest public project.
