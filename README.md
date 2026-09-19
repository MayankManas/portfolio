# Portfolio — Mayank Manas

Personal portfolio site for an active job hunt. Backend SDE-2, 5+ YOE, Java / Spring Boot / AWS.

**Status: planned, not built.** Planning is complete. No application code exists yet.

## What's here

```
CLAUDE.md                    project context — auto-loaded by Claude Code
docs/
  01-requirements.md         requirements + every settled decision + scope
  02-design.md               visual direction, IA, layouts, machine-readability spec
  03-architecture.md         repo structure, content schema, validation, deployment, cost
  04-implementation-plan.md  build phases in order + verification suite
content/
  resume.yaml                REAL seeded data, transcribed from his Aug 2026 résumé
  site.yaml                  REAL seeded section configuration
  projects/                  (empty — fileserver.md gets written in phase 4)
```

## The idea in one paragraph

The site is driven entirely by two YAML files. `content/resume.yaml` holds the facts; `content/site.yaml` holds an ordered list of sections, each declaring a layout from a small registry. The homepage is a single loop that dispatches on that layout, so adding a job, a skill, a project — or an entirely new section — is a content edit, never a code change. The same data generates both the website and an ATS-safe résumé PDF. Push to `main` and GitHub Actions validates, builds, regenerates the PDF, and deploys to Cloudflare Pages in about two minutes. Total cost: $0.

## Starting the build

Open this folder in a new session. `CLAUDE.md` loads automatically; read `docs/01-requirements.md`
and `docs/04-implementation-plan.md`, then begin at phase 1.

The two hard rules, restated because everything depends on them:

1. **Content and code are separate artifacts.** If changing what the site displays requires editing
   anything in `src/`, the design has failed.
2. **Everything must be machine-readable.** Companies screen with AI before a human reads anything.
   All content ships in the server-rendered HTML; collapsed content is hidden with CSS, never
   conditionally rendered.

## Needs your input before launch

- **Location** — your résumé says only "India"
- **LinkedIn URL**
- **Repo URLs** for FileServer, BFS/DFS Visualizer, Exercise Tracker
- **The "open to" line** — how you want your availability phrased
- **A confidentiality pass.** Your work is for Thales/Imperva. The site stays at exactly the
  abstraction level your own résumé uses, but a public website is more exposed than a résumé you
  hand to a recruiter. Worth a look before it goes live.
- **Consider adding FileServer to your actual résumé PDF** — it's currently missing, and it's your
  strongest publicly-discussable project.

All of these are marked `TODO` in `content/resume.yaml` and `content/site.yaml`.
