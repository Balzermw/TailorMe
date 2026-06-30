# Handoff: reliable URL import (LinkedIn job + profile)

Audience: Codex (or any dev) building out the "import from a URL" branch. Written
against the current TailorMe codebase. No em dashes in user-facing copy.

## Goal

Make "paste a URL" dependable for two distinct cases:

- **(A) JOB posting URL** -> clean posting text to score/tailor against (audit funnel).
- **(B) PROFILE URL** -> a resume to import (import funnel).

## TL;DR reality check (read before estimating)

- **Jobs are very feasible.** Most job pages (Greenhouse, Lever, Ashby, Workday,
  and often LinkedIn's public job view) embed a `schema.org/JobPosting` JSON-LD
  blob server-side with the title, company, and full description. Parse that and
  the auth-wall problem mostly disappears. This is the high-ROI work.
- **Profiles are NOT feasible via scraping.** A logged-out LinkedIn profile fetch
  hits an auth wall; scraping also violates LinkedIn's ToS. Use the user's own
  export (LinkedIn -> More -> Save to PDF, which we already parse) or a paid
  provider (cost + legal/vendor risk: Proxycurl, the leading profile API, was shut
  down by LinkedIn legal action in 2024).

## Current state (what already exists)

- `src/lib/url-fetch.ts` -> `fetchUrlText(rawUrl)`: SSRF-guarded fetch
  (`isPrivateIp`, `isBlockedHostname`), ~8s timeout, `MAX_FETCH_BYTES` (~2MB) cap,
  and `htmlToText(html)` to strip to plain text. Returns
  `{ ok: true, text } | { ok: false, reason: "invalid" | "blocked" | ... }`.
- `src/app/api/resume/from-url/route.ts`: `POST { url }` -> `fetchUrlText` ->
  `looksUnusable()` (auth-wall / thin-page detection) -> `{ text }` or
  `{ blocked: true }`. No LLM.
- **JOB path is already wired:** `src/app/audit/audit-wizard.tsx` `StepJob` accepts
  a URL in the posting box (placeholder "https://...  or paste the full posting",
  `wasUrl` state ~L1555, link-fetch branch ~L1618, "Parsed from a job link" label
  ~L1876). Today it uses the raw `htmlToText` strip, so LinkedIn/SPA job pages
  often yield auth-wall junk.
- **PROFILE path:** `src/app/resume/import/paste-import.tsx` LinkedIn modal
  (~L258-268) calls `/api/resume/from-url`; on `{ blocked: true }` it falls back to
  guided paste, then `structureText()` -> `POST /api/resume/structure`.

## Build A - JOB (do this first; highest ROI, lowest risk)

1. **JSON-LD extractor** in `src/lib/url-fetch.ts`:
   `extractJobPosting(html): { title?, company?, location?, description?, datePosted? } | null`
   - Match all `<script type="application/ld+json">...</script>`, `JSON.parse` each
     (tolerate parse errors, arrays, and `@graph` wrappers).
   - Select the node whose `@type` is (or includes) `"JobPosting"`.
   - Map: `title`; `hiringOrganization.name` -> company; `jobLocation.address...`
     -> location; `description` run through `htmlToText`; `datePosted`.
   - Return `null` if no JobPosting present.
2. **`from-url` route**: when `extractJobPosting` succeeds, return
   `{ job: {title, company, location, description}, text }` where `text` is a clean
   assembled posting: `${title} at ${company}\n${location}\n\n${description}`.
   Fall back to the current `htmlToText` path (and `looksUnusable`) when there is
   no JSON-LD. Keep `{ blocked: true }` for auth walls.
3. **LinkedIn job guest endpoint** (best-effort): add `linkedInJobId(url)` (matches
   `/jobs/view/{id}` and `?currentJobId={id}`). When present, fetch
   `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{id}` through the
   SSRF-guarded fetch and `htmlToText` the description container. Try this before
   the raw strip; fall through on any failure. Treat as fragile (ToS-gray, can change).
4. **StepJob**: prefer the structured `job.text` for scoring; optionally prefill
   the role/company labels from `job.title` / `job.company`. The "Parsed from a job
   link" affordance already exists.

## Build B - PROFILE (lower priority; pick a path)

- **Path 1 (recommended, free, compliant):** keep the modal's `blocked` -> paste
  fallback, but change the fallback copy to guide the LinkedIn "More -> Save to
  PDF" export and route the PDF into the EXISTING file/PDF importer on the import
  page. (Optional later: accept the LinkedIn data-export ZIP -> Positions.csv /
  Education.csv.)
- **Path 2 (optional, paid):** add a provider (People Data Labs / Coresignal /
  Bright Data) behind an env key (e.g. `LINKEDIN_PROFILE_API_KEY`). New server
  route maps provider JSON -> `TailoredDoc`. Gate by env (no key -> behave like
  today). Cache by URL hash; bound cost.
- **Path 3 (optional):** OIDC "Sign in with LinkedIn" for name/email/photo prefill
  only (the full positions/education APIs are partner-gated).

## Guards / invariants (non-negotiable)

- Every external fetch goes through (or mirrors) `fetchUrlText`'s SSRF guards:
  scheme allowlist, private/link-local IP block, timeout, body-size cap. The guest
  endpoint and any provider call included.
- **Privacy invariant:** never persist raw fetched HTML, resume text, job text, or
  PII; telemetry stays counts/ids/categories only (ALLOWED_EVENTS + sanitizeProps,
  CHECK-constraint migration, service-role writes).
- **Demo mode:** JSON-LD parsing is LLM-free and dependency-free, so it works with
  no keys. The provider path must no-op without its env key (-> blocked -> paste).
- No em dashes in user-facing copy.

## Tests (vitest)

- `extractJobPosting`: JobPosting JSON-LD as a bare object, inside an array, and
  inside `@graph` -> correct fields; HTML in `description` is stripped; `null` when
  absent or malformed.
- `linkedInJobId`: `/jobs/view/123`, `?currentJobId=123`, and a non-LinkedIn URL
  (-> null).
- SSRF: a JobPosting served from a private IP is still blocked.

## Acceptance criteria

- Pasting a Greenhouse/Lever/Ashby/Workday job URL into the audit posting box
  yields real posting text (title + company + description) and scores against it.
- Pasting a public LinkedIn job URL yields a usable description via JSON-LD or the
  guest endpoint; if blocked, the UI says so and offers paste.
- Pasting a LinkedIn profile URL falls back to Save-to-PDF / paste guidance (or, if
  a provider key is set, returns a structured profile).
- `npx tsc --noEmit` + `npm run lint` + `npx vitest run` green; demo mode unaffected.

## Risks

- LinkedIn ToS prohibits scraping. The guest endpoint and third-party providers are
  gray-area and can break without notice; keep them best-effort with graceful
  fallback. Choose providers aware that LinkedIn pursues them (Proxycurl shutdown,
  2024).
