---
title: FileServer
summary: >-
  A secure HTTPS file server for LAN environments. Streams files up to 100 GB
  without buffering, defends against directory traversal including the symlink
  case, and ships with 491 tests and a concurrency smoke test.
stack: [TypeScript, Node.js, Express, Jest]
role: Sole author
published: true
---

## Problem

I wanted to move large files between machines on my own network — backups, video,
disk images — without putting any of it through a third party. The options were
all wrong in the same direction. Consumer cloud sync is metered, slow for tens of
gigabytes, and means handing my files to someone else. Samba is fine until you
want to reach it from a phone. Most self-hosted "file manager" projects buffer
whole uploads into memory, which works beautifully in a demo with a 4 MB PDF and
falls over on a 40 GB one.

So the target was narrow and specific: an HTTPS file server for a single trusted
LAN, able to move a 100 GB file in either direction on hardware as small as a
Raspberry Pi, reachable from anything with a browser.

## Constraints

I wrote these down before writing code, in `ARCHITECTURE.md`, because they are
what make the design decisions below defensible rather than arbitrary.

- **Memory must stay flat regardless of file size.** A 100 GB transfer and a
  100 KB transfer should cost the same resident memory. This rules out buffering
  anywhere in the request path.
- **Runs on modest hardware.** A Pi or an old laptop. Idle footprint in the tens
  of megabytes, not hundreds.
- **LAN-only, but not naïvely trusting.** "It's on my network" is not a security
  model. Anything on the LAN — an IoT device, a guest phone, a compromised
  laptop — is a potential client.
- **Single instance, no external services.** No database to administer, no Redis,
  no cloud logging. It must survive a power cut and come back on its own.
- **~10 concurrent users, ceiling.** This is a household tool. Engineering for
  more would be engineering for an imaginary problem.

That last constraint did real work. It is the reason there is no distributed
rate-limit store, no session backend, and no formal load-testing rig — and being
explicit about it up front meant I could decline those without it being a gap.

## Decisions that mattered

### Streaming as an invariant, not an optimisation

Every read is `fs.createReadStream()` piped to the response; every write is the
request piped into `fs.createWriteStream()`. Nothing in the path accumulates a
buffer, so peak memory is a function of concurrency and chunk size, not file
size. Measured: ~50–100 MB idle, ~150–200 MB under five concurrent uploads.

The interesting part is what streaming costs you. A buffered upload can be
validated before anything touches disk. A streamed one is already writing while
you are still deciding whether you want it — so failure handling has to be
designed in rather than bolted on.

### Uploads land on a temp file and are renamed

Uploads stream to `<name>.tmp` and are renamed to the final name only on
successful completion. `rename` within a filesystem is atomic, so a reader can
never observe a half-written file — it either doesn't exist or it's complete.
A client that disconnects mid-transfer leaves a `.tmp` behind, and a scheduled
cleanup task reaps those on an interval.

This is the piece I'd point to if someone asked what separates this from a
tutorial. "Stream the upload to disk" is the obvious half. The consequence —
that partial state is now visible to other clients, and that crashes leave
garbage — is the half that actually has to be handled.

### Path traversal: the string check is not enough

The obvious defense is rejecting `..` and absolute paths, then confirming the
resolved path sits under the share root. I did that, and it is insufficient.

A symlink *inside* the share root can point outside it. So can an existing
intermediate directory that happens to be a symlink. String-level checks only
inspect the requested path — they never look at what is actually on disk — so a
request can pass every syntactic check and still resolve to `/etc/shadow`.

The fix walks up to the nearest ancestor that actually exists (the target itself
may legitimately not exist yet — that's an upload or a `mkdir`), calls
`fs.realpathSync` on it, and confirms the real, symlink-resolved path is still
inside the real share root:

```ts
let current = resolved;
while (!fs.existsSync(current)) {
  const parent = path.dirname(current);
  if (parent === current) return false;
  current = parent;
}
const realCurrent = fs.realpathSync(current);
return realCurrent !== realShareRoot
  && !realCurrent.startsWith(realShareRoot + path.sep);
```

Both the syntactic and the filesystem-level check are in place, because they
catch different things.

### Four independent security layers

No single control is load-bearing:

| Layer | Control |
|---|---|
| Network | IP whitelist — RFC1918 ranges only, 403 otherwise |
| Transport | HTTPS, with self-signed certificates auto-generated on first run |
| Auth | HTTP Basic Auth, credentials bcrypt-hashed at 10+ rounds |
| Application | Path validation, per-IP rate limiting, concurrent-stream caps |

The CIDR matching is implemented directly on 32-bit integers rather than pulled
from a dependency — it is about thirty lines, and an IP whitelist is not
something I wanted to delegate to a transitive package.

HTTP Basic Auth over TLS, revalidated per request, is a deliberate choice over
JWT. There are no sessions to expire, invalidate, or lose on restart. For a
single-instance household server, statelessness is worth more than the
ergonomics of a token.

### Structured logs, because grep is the only observability there is

Every event is a single-line JSON object with a stable `event` field — auth
attempts, transfers with byte counts and durations, rate-limit trips, stream
errors with their cleanup status. Winston handles rotation, capped at 10 MB and
seven files so a Pi's SD card can't fill up with logs.

There's no Prometheus and no dashboard, because there's no one to watch one.
When something breaks at home, you SSH in and read the log — and JSON lines
mean that's `jq`, not a regex against free-form prose.

## Outcome

It runs. It moves 100 GB files at roughly wire speed on a gigabit LAN
(~80–110 MB/s sustained, wired), memory stays flat under load, and I use it.

- **24 test files, 491 assertions** — unit coverage on path validation, auth,
  the credential store, MIME detection and upload handling, plus supertest
  integration suites covering every endpoint, full workflows, app wiring and
  edge cases.
- **A concurrency smoke test** (`npm run smoke-test`) that boots a real instance
  against a throwaway share root, drives ten simulated clients through a mixed
  workload of listing, downloading and uploading, and asserts on what actually
  matters: nothing errored, memory stayed under a 500 MB ceiling, and `/files`
  stayed under 200 ms. Each simulated client gets its own source IP so the test
  measures concurrency rather than tripping the server's own rate limiter.
- **A pre-development architecture document** with the component breakdown,
  data-flow diagrams, a threat table, and an explicit extensibility story —
  middleware seams for future auth schemes, and a storage layer that is just a
  filesystem path, so moving the share to a NAS mount needs no code change.

Writing that document first is why the constraints section above exists at all.
It is also where I caught a bad requirement: `REQUIREMENTS.txt` had specified
ten concurrent connections at 100 MB/s each — about 8 Gbps aggregate, which no
home network can deliver. Better to find that on paper than to spend a week
optimising toward a number that was never physically reachable.

## What I'd change

- **The credential store is in-memory with a JSON backing file.** Fine for a
  handful of users; the migration path to SQLite is designed but not built. I
  stopped at the point where the simpler thing still worked.
- **No resumable uploads.** A dropped connection at 95 GB means starting over.
  Range-based resume is the single feature that would most improve the thing in
  practice, and it is the obvious next piece of work.
- **Directory listings are built with synchronous `readdir`/`stat` calls.**
  Invisible at household scale, and genuinely wrong for a deep tree — it blocks
  the event loop. I would make it async and paginate before letting this near a
  directory with tens of thousands of entries.
- **IPv4-only CIDR matching.** The whitelist parses `a.b.c.d/n` and nothing
  else. A LAN that does real IPv6 addressing would need that rewritten.
