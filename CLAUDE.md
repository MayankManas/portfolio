# Portfolio Site — Project Context

Personal portfolio site for **Mayank Manas**, Backend SDE-2 (5+ YOE, Java/Spring Boot/AWS), built for an active job hunt.

**Status: planned, not yet scaffolded.** No code exists yet. Planning is complete and lives in `docs/`. Seed content is already written in `content/`.

## Read these before doing anything

| File | What it holds |
|---|---|
| `docs/01-requirements.md` | The requirements and every decision already settled with the user. **Read first.** |
| `docs/02-design.md` | Visual direction, information architecture, layout catalogue, machine-readability spec |
| `docs/03-architecture.md` | Repo structure, content schema, validation rules, deployment pipeline |
| `docs/04-implementation-plan.md` | Build phases in order + the verification suite |
| `content/resume.yaml` | Real seeded résumé data (already transcribed from his Aug 2026 PDF) |
| `content/site.yaml` | Real seeded section configuration |

Start at phase 1 of `docs/04-implementation-plan.md`.

## The two hard rules

**1. Content and code are separate artifacts.**
The whole reason this project exists. Adding a job, workstream, skill, project, or an entirely
new section must be a *content edit* to `content/*.yaml` — never a markup change. Renderers are
generic and dispatch on a `layout` field. If a change to what the site displays requires editing
anything in `src/`, the design has failed.

**2. Everything must be machine-readable.**
The user explicitly prioritized AI/ATS scrapability, because companies screen with AI before a
human reads anything. Consequences that are easy to get wrong:
- All content ships in the server-rendered HTML. Nothing requires JS to be readable.
- Progressive disclosure (collapsed experience bullets) hides overflow with **CSS only** — never
  conditional rendering. Scrapers must receive every bullet.
- No text inside images, SVG text, or canvas. The animated metric counters animate real text nodes.
- The résumé PDF must have a real, selectable text layer and stay ATS-safe: single column,
  conventional headings, no icon fonts, no tables used for layout.

## Scope corrections — do not get these wrong

- **ApplyPilot is NOT his project.** It is a third-party tool he *uses* to search and apply for
  jobs. It must not appear anywhere on the site. (It happens to be cloned in a sibling directory;
  ignore it.)
- **FileServer IS his project** and is the flagship. Active side project, lives at
  `../FileServer`. Read its `README.md` and `ARCHITECTURE.md` when writing the case study.
- **Dropped deliberately:** `multithreading-exercises`, `card-game` — student-tier work that
  dilutes a 5-YOE profile. `Exercise-tracker` and `BFS/DFS Visualizer` are minor cards only.
- His professional work is **client-confidential** (Thales / Imperva). Keep the public site at
  exactly the abstraction level his own résumé already uses. Do not add detail beyond it.

## Stack

Astro 5 (static output) · Tailwind v4 · TypeScript strict · Zod via Astro content collections ·
Playwright for PDF generation · GitHub Actions → Cloudflare Pages.

Hosting, building and deploying must stay **$0**. Public repo (unlimited Actions minutes) +
Cloudflare Pages free tier. A custom domain is optional and deferred.
