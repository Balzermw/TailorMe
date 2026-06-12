# TailorMe by Res.Me — Design & Asset Brief

A self-contained brief for creating graphics, page designs, and visualizations. No outside context required.

---

## 1. Project snapshot

**TailorMe by Res.Me** is a web app that tailors a candidate's resume to a *specific* job posting, reviews it with specialist AI agents, and offers an optional paid human-expert pass. It is the hosted, multi-user repackaging of an open Claude Code engine (`github.com/Balzermw/ai-job-search-resme`) — a local, file-based job-application assistant — turned into a pay-per-application SaaS. TailorMe is a sub-product of **Res.Me** (the parent brand: Technical Resume Writing).

**Primary message:** *Your experience is stronger than your resume makes it look.*

---

## 2. Brand

**Names:** Res.Me (parent) · TailorMe (this product). Lockup: "TailorMe by Res.Me".

**Logo mark:** a fountain-pen nib on a blue document that rolls forward into a green scroll, with a light-gray document peeking behind it. The wordmark "Res.Me" uses a near-black weight with the period as a blue dot.

**Colors (exact):**
| Token | Hex | Use |
|---|---|---|
| Brand blue 600 | `#4373db` | Primary buttons, accents, active states |
| Brand blue 400 | `#6e94e6` | Secondary accent, arrows |
| Brand blue 200 | `#a9c2f0` | Light highlights |
| Brand blue 50 | `#edf2fc` | Tints, pill backgrounds |
| Brand blue 800 | `#2a4c99` | Text on light-blue fills |
| Mint green 400 | `#2dbd8b` | Success, "after" highlights, checks |
| Mint green 600 | `#21926b` | Mint text/icons |
| Mint green 50 | `#e3f7f0` | Keyword-match pills, success tints |
| Light gray | `#eceef0` | Logo backplate, surfaces |
| Near-black | `#18181b` | Wordmark, body text |
| Zinc 500 | `#71717a` | Muted/secondary text |

**Typography:** clean geometric sans (Geist / Inter family). Two weights only — 400 regular, 500 medium. Sentence case everywhere (never Title Case or ALL CAPS).

**Visual style:** flat and clean. White surfaces, 0.5px borders, generous whitespace, rounded corners (8–16px). **No** gradients, drop shadows, glow, or noise. Restrained two-color palette (blue + mint) on white.

**Voice:** confident, empathetic, specific. Lead with concrete numbers and outcomes, never hype. Talk to the candidate as "you." Never promise jobs or interviews.

---

## 3. Audience (from customer research)

- ~77% of customers are **senior or above**. Biggest single segment: **Senior Software Engineers (19%)**, then Professional Services (~17%), Sales/CS (15%), IT/Cloud (13%).
- **Core tension:** they *think* they need a better template + more keywords; they *actually* need role-specific positioning, impact translation, and ATS alignment.
- **Emotional pains (use as copy):** "my strong work reads like a task list," "low response rates," "recruiters don't understand my value," ATS-filter anxiety.
- **Flagship persona for the worked example:** "Alex M.", Senior Software Engineer, 7 yrs (a **labeled composite**, never a real client).

---

## 4. What the product does (functionality + technical)

**User journey (5 steps):**
1. I have a resume → upload; system extracts a structured profile.
2. I want this job → paste a job URL or raw posting text.
3. We tailor it → every bullet rewritten and re-ranked for that posting; ATS keywords aligned.
4. Agents review it → three specialist reviewers return actionable, line-level fixes.
5. Human review (optional, paid) → a Res.Me writer does a final line-by-line pass (+$49/application).

**The engine (the `/apply` pipeline)** — a strict ordered loop:
Parse posting (WebFetch URL or pasted text) → **Evaluate fit** → **Draft** resume + cover letter in LaTeX → **Review** (a separate freshly-spawned agent researches the company, returns a JSON edit array + narrative) → **Apply** edits → **Compile & inspect PDF** (render, read back, fix page-break/orphan issues, re-render) → **Verify** once against a checklist.

**3 specialist review agents:** ATS & keywords · Impact & metrics · Role-fit.

**Job-fit scoring model (weighted average across five dimensions):**
- Technical Skills Match — 0–100
- Experience Match — 0–100
- Behavioral / Culture Fit — 0–100
- Career Alignment & Motivation — 0–100
- Location & Logistics — PASS / FAIL gate
- Verdict tiers: Strong → Good → Moderate → Weak → Poor Fit.

**Document engine:** LaTeX, `moderncv` banking style; lualatex (resume), xelatex (cover letter); relevance-weighted cutting to a hard 2-page resume / 1-page cover letter.

**Tech stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, framer-motion, lucide-react. Planned services: Supabase (auth, Postgres, encrypted resume storage), Stripe (credit packs), backend on Claude API or Managed Agents. Default model: Claude Sonnet 4.6, with cost guardrails.

**Business model:** pay-per-application credit packs — $19/5, $49/15, $99/40 (credits never expire) · +$49/application for human expert review · first application free ("free audit"). No subscription, no user API keys.

---

## 5. Homepage story structure (research-backed)

Grounded in three converging frameworks — **PAS** (Problem–Agitate–Solution), **StoryBrand SB7** (customer = hero, brand = guide), and 2026 SaaS conversion patterns (outcome-driven storytelling, multiple trust signals, interactive demo, FAQ, one primary CTA).

| # | Section | Framework stage | Contains |
|---|---|---|---|
| 1 | Hero | Character + outcome | Eyebrow (category) · "stronger than your resume" headline · primary CTA "Get a free resume audit" + transitional CTA "See a real transformation" |
| 2 | Problem & stakes | Problem / Agitate | The pain in their words + the cost of leaving it (source: research pain points) |
| 3 | Guide + trust | Guide | Res.Me empathy + authority (pro writers + specialist agents) + first trust signals |
| 4 | The plan — 3 steps | Plan | Upload → paste job → download tailored resume + feedback |
| 5 | The transformation | Proof / Demo | 5-step journey, before/after bullets, live pipeline demo, 3-agent feedback |
| 6 | Success payoff | Success | The after-state: recruiter-ready, reads at your level (no guarantees) |
| 7 | Pricing + human review | Offer | Credit packs + the +$49 human pass |
| 8 | FAQ / objections | Objections | Built from research objections; also feeds AI search |
| 9 | Final CTA + footer | CTA | Repeat the one primary CTA + GDPR/encryption trust strip |

**CTA discipline:** one primary CTA ("Get a free resume audit") repeated; "See a real transformation" is the transitional CTA.

---

## 6. Assets to create

1. **Hero illustration/graphic** — a resume document transforming/leveling-up (blue→mint), abstract and flat, supports white hero.
2. **5-step journey graphic** — numbered horizontal/vertical flow: have resume → want job → tailor → agents review → human pass.
3. **Before/after resume mockup** — two stylized resume cards; "before" muted task bullets, "after" with mint-highlighted impact + keywords.
4. **Job-fit scoring visual** — radar or horizontal bar chart of the 5 dimensions (sample: Technical 88, Experience 80, Culture 74, Career 90; Location = PASS).
5. **3-agent panel graphic** — three labeled cards (ATS & keywords, Impact & metrics, Role-fit) each emitting a "fix"/"polish" note.
6. **Pipeline flow diagram** — Parse → Evaluate → Draft → Review → Apply → Compile & inspect → Verify (loop emphasis on compile-inspect).
7. **Architecture diagram** — frontend (Next.js/React/Tailwind) · services (Supabase, Stripe) · AI backend (Claude / Managed Agents + LaTeX) · split "shipping engine today" vs "TailorMe productization".
8. **Pricing tiers graphic** — 3 credit packs + human-review add-on row.
9. **Trust/compliance strip icons** — encrypted at rest · one-click delete · GDPR.
10. **Social / OG images** — 1200×630 with the primary headline + logo lockup.

---

## 7. Guardrails (must hold in every asset)

- **No** guaranteed jobs, interviews, salary increases, or "ATS bypass" claims. Use "interview-ready," "recruiter-ready."
- Any featured resume/candidate is a **labeled composite**, never real client data.
- Resume data is **encrypted at rest** with **one-click deletion** (GDPR-aligned) — fine to show as trust signals.
- Distinguish productization (3-agent panel, Supabase/Stripe) from the shipping engine (single reviewer, local/file-based) when accuracy matters.

---

## 8. Visualization-ready data blocks

**Scoring (sample run — flagship persona):**
```
Technical Skills: 88
Experience Match: 80
Behavioral/Culture Fit: 74
Career Alignment: 90
Location: PASS
Overall: 84 — Strong Fit
```

**Pricing:**
```
Starter   $19  → 5 applications  ($3.80 each)
Job hunt  $49  → 15 applications ($3.27 each)   [most popular]
All in    $99  → 40 applications ($2.48 each)
Human review add-on: +$49 / application
First application: free
```

**Flagship transformation (composite — "Alex M." → "Nordpeak Systems", Senior Platform Engineer):**
```
BEFORE: "Responsible for developing and maintaining features for the web app using React and Node.js."
AFTER:  "Led migration of checkout to a distributed Node.js service, cutting p95 latency 38% across 2.4M daily transactions."

BEFORE: "Participated in code reviews and mentoring."
AFTER:  "Mentored 6 engineers through promotion cycles while owning Kubernetes deployment standards."

Keyword alignment matched: Distributed systems · Node.js at scale · Kubernetes · Observability · Mentorship
```

**Pipeline stages (for a flow diagram):**
```
Parse posting → Evaluate fit (5 dims) → Draft (LaTeX) → Agent review (ATS / impact / role-fit) → Apply edits → Compile & inspect PDF (loop) → Verify checklist
```

**Tech stack layers (for an architecture diagram):**
```
Frontend:  Next.js 16 · React 19 · TypeScript · Tailwind v4 · framer-motion
Services:  Supabase (auth + Postgres + storage) · Stripe (credits)
AI:        Claude Sonnet 4.6 · drafter → reviewer agents · LaTeX compile/inspect (Managed Agents container)
Engine:    moderncv/LaTeX · lualatex + xelatex · Bun/TS job scrapers (origin repo)
```
