# TailorMe Resume Editor — Final Implementation Plan

> Produced by a multi-agent research + design pass (mapped pipeline, results UI,
> persistence/render, existing editing; weighed 3 editor architectures).

## 1. Context & goal

Today the paid `mode:"full"` run is a dead-end. `runFull()` (`audit-wizard.tsx:2382-2419`) POSTs to `/api/apply`, the server inserts one write-once row into `applications` with the entire `ApplyResult` JSON in `result` (`apply/route.ts:130`), and Step 3 flips in-place to a read-only success card offering PDF / .tex / dashboard links. The full structured `result.doc` (`TailoredDoc`) is returned but **never read by the wizard** — the single biggest unused asset in the product.

**New flow:** enter resume + posting → AI suggests & implements the tailored doc (unchanged, 1 credit) → **review every change in an editor tree with per-line accept / reject / edit** → see a **real, data-driven before/after** (not the hardcoded landing mocks) → save (free, no LLM) → downloads re-render automatically.

**Why it matters:** converts a take-it-or-leave-it artifact into a controllable one — trust (see/approve each rewrite), agency (fix the AI's misses without burning a credit), and a reason to return (dashboard links into a living document). Turns the static `docs-compare.tsx` "before vs after" marketing claim into a feature the user experiences on their own resume.

## 2. Recommended architecture

**Primary: "Editor Tree" on a dedicated `/applications/[id]/edit` route, backed by the persisted row.** Beats an inline 4th wizard step because the wizard holds state in memory and remounts on `key={step}` — an inline editor loses everything on refresh and can't be deep-linked. A persisted route survives reload, is shareable, and reuses the existing `/applications/[id]/*` namespace (`print`, `pdf`, `latex`).

**Grafted from the runner-up approaches:**
- **Pure resolver `applyDecisions(doc, bulletDiffs, decisions) → TailoredDoc`** (new `lib/apply/redline.ts`) feeding every view; makes save trivial (`save = applyDecisions(...)`).
- **Emit `bulletDiffs` at generation time** inside the pipeline, where both the original line and the rewritten doc bullet are in scope — the honest fix for the hardest constraint: showcase `result.bullets[].after` are NOT verbatim substrings of `doc.experience[].bullets` (`pipeline.ts:1266-1268`), so they can't be mapped post-hoc.
- **Store an `originalDoc` snapshot** so "reset to AI version" is always possible.

**Deferred:** single-line AI re-tailor (the only editor action needing credit/rate gating + a new prompt) → Phase 5.

## 3. Data model changes

Everything rides inside the existing `applications.result` jsonb — **no SQL migration for v1**. Add to `ApplyResult` (`src/lib/types.ts:170-180`), all optional for back-compat:

```ts
export interface BulletDiff {
  entry: number;   // index into doc.experience, taken AFTER verifyDoc's same-shape adoption
  bullet: number;  // index into experience[entry].bullets
  before: string;  // pre-rewrite original line (captured in-pipeline)
  after: string;   // shipped doc bullet (== doc.experience[entry].bullets[bullet] at gen time)
}
export type EditDecision = "accepted" | "rejected" | "edited";
export interface ApplyResult {
  // ...existing...
  originalDoc?: TailoredDoc;     // AI draft snapshot for "reset to AI version"
  bulletDiffs?: BulletDiff[];    // per-bullet before/after, anchored to stored coordinates
  edits?: {
    savedAt: string;
    decisions: Record<string, EditDecision>; // key = `${entry}:${bullet}` | "summary" | `skill:${i}` | `cover:${i}` | `header:${field}`
    userEdited: boolean;          // any hand-edit → drives trust-badge downgrade
  };
}
```

- **original** = `bulletDiffs[].before` (experience bullets); summary/skills/cover/header are edit-only, `originalDoc` is their fallback original.
- **current** = `doc` (editor writes the resolved doc back into `result.doc`).
- **decision** = `result.edits.decisions[key]`, restored on reopen.
- **AI baseline** = `result.originalDoc`, never overwritten.

**Coordinates not minted IDs:** `{entry,bullet}` is stable *because* it's captured after `verifyDoc`'s same-shape guard (`pipeline.ts:765-800`) and `clampToTwoPages` stays render-time-only (`latex.ts:95`). Keeps `TailoredDoc` shape untouched (`renderResumeTex`/`PrintDoc`/`clampToTwoPages` unchanged). Cover letter stays a `\n\n`-joined string, split per-paragraph via `coverParagraphs()` for editing and re-joined on save.

## 4. Editor tree UX

Route `/applications/[id]/edit` (server shell + client editor). Add `editApplication(id)` to `ROUTES` (`data.ts:118-134`); add **"Open in editor"** to the StepResults success card (`audit-wizard.tsx:2422`) and an **"Edit"** link in `dashboard-live.tsx`.

Three panes, all reusing existing CSS:
- **Left — `<EditorTree>`** built from `TailoredDoc`'s natural structure (Document → Summary → Experience entries → bullets → Skills → Cover paragraphs); each node shows a status chip + pending-suggestion badge. Reuse `DeepDive` collapsible + `tm-pill`/`tm-card`.
- **Center — editing canvas.** Bullets with a `BulletDiff` render a **diff row** (reuse `tmB-tl-rw/before/after` + `ImpactEvidence` BEFORE/AFTER box) with **Accept / Reject / Edit** (`pending → accepted | rejected | edited`). Header/summary/skills/cover = plain `<textarea>`, default `accepted`.
- **Right — live `<PrintDoc>` preview** after `clampToTwoPages`, with a "fits 2 pages / will be trimmed" indicator and a `tmF-gate`-styled Save footer + Download buttons (`pdfHref`).

## 5. Before/after visualization

Three switchable views over the one pure resolver:
1. **Diff rows (default)** — real per-bullet before→after (the data-driven version of `docs-compare.tsx`'s fake sample).
2. **Split** — reuse `tmT-docs` two-column "Before | → | After" paper layout, made data-driven (Before = `originalDoc`, After = live doc). Requires parameterizing `docs-compare.tsx` (currently hardcoded, no props).
3. **Clean** — resolved doc, `clampToTwoPages` live, over-length warning.

**Highlighting (net-new, no dep):** `highlightKeywords(text, keywords)` wraps `result.keywords` in `<mark className="tm-k">` (mint) and metric tokens in `<mark className="tm-m">` (blue) — CSS exists at `globals.css:217-230`. **Returns React nodes, never HTML** (model output is unsanitized; `types.ts:69-74` forbids `dangerouslySetInnerHTML`).

## 6. Persistence & re-render

**Save path (the one missing primitive — `db.ts` is read-only):** new `PATCH /api/applications/[id]` (`src/app/api/applications/[id]/route.ts`):
1. `getServerSupabase()` (cookie-bound, RLS) — never the service-role client.
2. `auth.getUser()`, fetch existing `result`.
3. Deep-merge `{ ...result, doc: editedDoc, originalDoc, bulletDiffs, edits }`.
4. Server-side validate/clamp: `clampToTwoPages`, `limits.ts` caps, empty-bullet/`escapeLatex` safety so an edit can't break the LaTeX compile.
5. `update({ result }).eq("id", id).eq("user_id", user.id)` (ownership on top of RLS).
6. **Never `consume_credit`** — editing is manual, no LLM.

**Re-render: zero new code.** `/print`, `/pdf`, `/latex` already re-derive from `result.doc` each request, so the next hit produces the updated output automatically.

**Auth/demo:** editing only for signed-in users with a persisted row; demo/`sample` → editor hidden/404. **Trust copy:** on save, if `userEdited`, downgrade "Verified against your resume" → neutral **"Edited by you — not re-verified"** (full re-`verifyDoc` deferred — it can return `"unavailable"` on a reshaped doc).

## 7. Phased rollout (each independently shippable)

- **Phase 1 — Save path + data-driven render + edit-only editor.** Ships edit→save→re-render. New `PATCH` route, `db.ts` save fn, parameterize `print-doc.tsx`/`docs-compare.tsx`/`result-docs.tsx`, new `/edit` page + client editor (plain textareas), `ROUTES` + CTAs.
- **Phase 2 — Editor tree + accept/reject/edit on `bulletDiffs`.** The core feature. Pipeline emits `bulletDiffs`+`originalDoc` (post-verify); `<EditorTree>`, `<DiffRow>`, `redline.ts` resolver; persist/restore `edits`. Old rows degrade to edit-only.
- **Phase 3 — Before/after viz + highlighting.** `highlightKeywords`, 3-view toggle, two-page guard, "X of N resolved" bar.
- **Phase 4 — Trust + polish.** Badge downgrade, "reset to AI version", over-length warnings, AuditAgent/Verification decorations.
- **Phase 5 (optional) — Single-line AI re-tailor.** New `POST /api/applications/[id]/retailor-line`, credit/rate-gated.

## 8. Open decisions (recommended defaults)

1. **Re-verify on edit vs downgrade badge?** → *downgrade only in v1.*
2. **Revision history vs overwrite?** → *overwrite `result.doc`, preserve `originalDoc`.*
3. **Coordinates vs minted IDs?** → *`{entry,bullet}` captured post-verify.*
4. **`edited_at` column for a dashboard badge?** → *skip v1.*
5. **Editor post-tailor only, or re-openable from dashboard?** → *both* (the point of a route).

## 9. Risks & verification

**Risks:** bullet→coordinate mapping fidelity (solved by in-pipeline capture post-verify; keep clamp render-time-only); plain-text safety (nodes never HTML); result blob ~2× per row (fine for jsonb); back-compat for old rows; PATCH must never consume a credit.

**E2E checks:** full tailor persists `doc`/`bulletDiffs`/`originalDoc`; `/edit` renders tree + diff rows; accept/reject/edit → `applyDecisions` pure + preview updates; save writes via PATCH, no credit spent, RLS blocks other users; `/pdf` + `/latex` reflect edits with no render-code change; hand-edit → badge downgrade; >2 pages warns + still compiles; demo/signed-out hidden; reopen restores decisions; `npm run build` clean, no new deps.
