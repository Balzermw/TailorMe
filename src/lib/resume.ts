"use client";

// Saved-resume store for the "upload once" flow. Real mode persists to the
// user's account via /api/resume (RLS-scoped); demo mode persists to
// localStorage so the flow still works without Supabase. All calls are
// best-effort — a signed-out or failed save is a silent no-op.

import type { ProofPoint, ResumeStats, TailoredDoc } from "@/lib/types";
import { supabaseConfigured } from "@/lib/config";
import { docToResumeText } from "@/lib/apply/serialize";
import { cleanResumeDocDates } from "@/lib/apply/dates";
import { normalizeContactLine } from "@/lib/apply/contact";

export interface SavedResume {
  name: string;
  text: string;
  stats: ResumeStats | null;
  doc?: TailoredDoc | null; // structured base resume (build-from-scratch / editor)
  source?: string; // 'uploaded' | 'scratch' | 'pasted'
  createdAt?: string; // first time this profile was saved (preserved across re-saves)
  savedAt?: string; // most recent save/edit
}

// Derive display stats straight from a structured doc. The doc is the source of
// truth, so reuse paths (a saved/base resume opened without a persisted parse)
// get accurate profile tiles instead of zeros. Pure + client-safe.
export function statsFromDoc(doc: TailoredDoc): ResumeStats {
  // Defensive: docs come from localStorage / JSON.parse and may not honor the
  // TailoredDoc type (legacy or hand-edited), so filter null entries and coerce
  // bullets/skills to strings rather than trusting the shape.
  const exp = (doc.experience ?? []).filter(Boolean);
  const bullets = exp
    .flatMap((e) => (Array.isArray(e?.bullets) ? e.bullets : []))
    .filter((b): b is string => typeof b === "string");
  // A line is "quantified" if a digit survives stripping years, quarter tokens
  // (Q3), and slash dates (3/5) — so "led 3-5 engineers" and "6 reports" count,
  // but "Q3 2021 launch" doesn't.
  const hasMetric = (l: string) =>
    /\d/.test(
      l
        .replace(/\b(19|20)\d{2}\b/g, " ")
        .replace(/\bq[1-4]\b/gi, " ")
        .replace(/\b\d{1,2}\/\d{1,2}\b/g, " "),
    );
  const groups = (doc.skillGroups ?? []).filter(Boolean);
  const skills = (
    groups.length
      ? groups.flatMap((g) => (Array.isArray(g?.skills) ? g.skills : []))
      : doc.skills ?? []
  ).filter((s): s is string => typeof s === "string");
  // Earliest 4-digit year across the experience date ranges → rough YOE.
  const years = exp
    .flatMap((e) => (typeof e?.dates === "string" ? e.dates.match(/\b(19|20)\d{2}\b/g) ?? [] : []))
    .map(Number)
    .filter((n) => n > 1900);
  const earliest = years.length ? Math.min(...years) : null;
  const yoe = earliest ? Math.max(0, new Date().getFullYear() - earliest) : undefined;
  return {
    name: doc.name || "Your resume",
    roles: exp.length,
    bullets: bullets.length,
    metricBullets: bullets.filter(hasMetric).length,
    skills,
    primaryRole: doc.headline || exp[0]?.role,
    yearsExperience: yoe,
    sampleBullets: bullets.slice(0, 5).map((text) => ({ text, hasMetric: hasMetric(text) })),
  };
}

/** True when stats are absent or all-zero (e.g. the fabricated reuse placeholder). */
export function statsAreEmpty(stats: ResumeStats | null | undefined): boolean {
  return !stats || ((stats.roles ?? 0) === 0 && (stats.bullets ?? 0) === 0);
}

const LS_KEY = "tm_resume_v1";

function isLegacyDemoResume(value: SavedResume): boolean {
  const haystack = JSON.stringify({
    name: value.name,
    text: value.text,
    docName: value.doc?.name,
    headline: value.doc?.headline,
    coverLetter: value.doc?.coverLetter,
  });
  return (
    /Alex Mercer/i.test(haystack) &&
    /(Nordpeak|Brightline|Datadog|checkout migration)/i.test(haystack)
  );
}

export async function loadSavedResume(): Promise<SavedResume | null> {
  if (supabaseConfigured) {
    try {
      const res = await fetch("/api/resume");
      if (!res.ok) return null;
      const data = await res.json();
      return (data.resume as SavedResume | null) ?? null;
    } catch {
      return null;
    }
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedResume;
    if (isLegacyDemoResume(saved)) {
      window.localStorage.removeItem(LS_KEY);
      clearResumeDraft();
      clearTargetResume();
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export async function saveResume(resume: SavedResume): Promise<void> {
  if (!resume.text?.trim()) return;
  if (supabaseConfigured) {
    try {
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resume.name,
          text: resume.text,
          stats: resume.stats,
        }),
      });
    } catch {
      /* signed out or offline — non-fatal */
    }
    return;
  }
  if (typeof window === "undefined") return;
  try {
    const now = new Date().toISOString();
    // Preserve the original creation time across re-saves (fall back to a prior
    // savedAt for profiles that predate createdAt tracking).
    let prevCreated: string | undefined;
    try {
      const prev = window.localStorage.getItem(LS_KEY);
      const parsed = prev ? (JSON.parse(prev) as SavedResume) : null;
      prevCreated = parsed?.createdAt ?? parsed?.savedAt;
    } catch {
      /* ignore */
    }
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        ...resume,
        createdAt: resume.createdAt ?? prevCreated ?? now,
        savedAt: now,
      }),
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

const DRAFT_KEY = "tm_resume_draft"; // sessionStorage handoff: builder -> editor
const DRAFT_PP_KEY = "tm_resume_draft_pp"; // optional advice carried with a draft
const DRAFT_META_KEY = "tm_resume_draft_meta"; // whether this draft may replace the saved base

function writeLocalDoc(
  doc: TailoredDoc,
  source?: string,
  proofPoints?: ProofPoint[],
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cleanedDoc = cleanResumeDocDates({
      ...doc,
      contact: normalizeContactLine(doc.contact),
    });
    const prev = window.localStorage.getItem(LS_KEY);
    const parsed = prev ? (JSON.parse(prev) as SavedResume) : null;
    const base = parsed && !isLegacyDemoResume(parsed) ? parsed : null;
    // Stash import/feedback proof points in stats so the demo editor can reopen
    // them later (the live path persists to resumes.stats via /api/resume/doc).
    const stats =
      proofPoints && proofPoints.length
        ? ({ ...(base?.stats ?? {}), proofPoints } as ResumeStats)
        : base?.stats ?? null;
    const now = new Date().toISOString();
    const saved: SavedResume = {
      name: cleanedDoc.name || base?.name || "My resume",
      text: docToResumeText(cleanedDoc),
      stats,
      doc: cleanedDoc,
      source: source ?? base?.source ?? "scratch",
      createdAt: base?.createdAt ?? base?.savedAt ?? now,
      savedAt: now,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

// Persist a STRUCTURED base resume (build-from-scratch + base-resume editor).
// Live + signed-in → the account (/api/resume/doc). Demo mode, or live-mode anon
// → the browser (localStorage), so an unsigned user's build still survives.
export async function saveResumeDoc(
  doc: TailoredDoc,
  source?: string,
  proofPoints?: ProofPoint[],
): Promise<{ ok: boolean; error?: string }> {
  if (supabaseConfigured) {
    try {
      const payload: Record<string, unknown> = { doc };
      if (source) payload.source = source;
      if (proofPoints && proofPoints.length) payload.proofPoints = proofPoints;
      const res = await fetch("/api/resume/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && !data.local) return { ok: true }; // saved to the account
      // anon in live mode (data.local) or a soft error → keep it in the browser
    } catch {
      /* offline → fall back to localStorage */
    }
  }
  return writeLocalDoc(doc, source, proofPoints)
    ? { ok: true }
    : { ok: false, error: "Couldn't save your resume." };
}

// Feedback proof points persisted alongside a demo/anon resume (live signed-in
// reopens read these from the account server-side instead).
export function loadSavedProofPoints(): ProofPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    const saved = raw ? (JSON.parse(raw) as SavedResume) : null;
    const pp = (saved?.stats as { proofPoints?: ProofPoint[] } | null)?.proofPoints;
    return Array.isArray(pp) ? pp : [];
  } catch {
    return [];
  }
}

// Resolve the base resume for the editor/print view: a freshly-built draft
// handed off from the builder wins, then the saved resume (account or browser).
export async function loadBaseResumeDoc(): Promise<TailoredDoc | null> {
  if (typeof window !== "undefined") {
    try {
      const draft = window.sessionStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft) as TailoredDoc;
    } catch {
      /* ignore */
    }
  }
  const saved = await loadSavedResume();
  if (saved?.doc) return saved.doc;
  if (supabaseConfigured && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      const ls = raw ? (JSON.parse(raw) as SavedResume) : null;
      if (ls?.doc) return ls.doc;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export type ResumeDraftOptions = {
  persistOnLoad?: boolean;
};

// Hand a structured doc to the editor. Optional proofPoints carry advice (e.g.
// from the free audit) so the editor's Suggestions panel shows it for a draft;
// passing none clears any stale carried advice. Drafts only persist over the
// saved base resume when the caller opts in after an explicit replace decision.
export function setResumeDraft(
  doc: TailoredDoc,
  proofPoints?: ProofPoint[],
  options?: ResumeDraftOptions,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
    window.sessionStorage.setItem(
      DRAFT_META_KEY,
      JSON.stringify({ persistOnLoad: Boolean(options?.persistOnLoad) }),
    );
    if (proofPoints && proofPoints.length) {
      window.sessionStorage.setItem(DRAFT_PP_KEY, JSON.stringify(proofPoints));
    } else {
      window.sessionStorage.removeItem(DRAFT_PP_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Proof points carried alongside a one-time draft handoff (audit → editor). */
export function loadResumeDraftOptions(): ResumeDraftOptions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(DRAFT_META_KEY);
    const parsed = raw ? (JSON.parse(raw) as ResumeDraftOptions) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadDraftProofPoints(): ProofPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(DRAFT_PP_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as ProofPoint[]) : [];
  } catch {
    return [];
  }
}

export function clearResumeDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
    window.sessionStorage.removeItem(DRAFT_PP_KEY);
    window.sessionStorage.removeItem(DRAFT_META_KEY);
  } catch {
    /* ignore */
  }
}

export function hasResumeDraft(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return false;
  }
}

// In-progress import INPUT (the pasted text), saved as the user types so they can
// "pick up where you left off" on a later visit. Distinct from tm_resume_draft
// (a finished doc handed to the editor): this is the raw, unstructured input.
const WIP_KEY = "tm_resume_wip";
const WIP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a week

export interface ResumeWip {
  kind: "import";
  text: string;
  savedAt: string; // ISO
}

export function saveResumeWip(text: string): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  try {
    if (trimmed.length < 40) {
      window.localStorage.removeItem(WIP_KEY); // too little to be worth resuming
      return;
    }
    const wip: ResumeWip = { kind: "import", text, savedAt: new Date().toISOString() };
    window.localStorage.setItem(WIP_KEY, JSON.stringify(wip));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/** The saved in-progress import, if it exists and is recent (else cleared). */
export function loadResumeWip(): ResumeWip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WIP_KEY);
    if (!raw) return null;
    const wip = JSON.parse(raw) as ResumeWip;
    if (!wip?.text?.trim()) return null;
    const age = Date.now() - new Date(wip.savedAt).getTime();
    if (!Number.isFinite(age) || age > WIP_MAX_AGE_MS) {
      window.localStorage.removeItem(WIP_KEY);
      return null;
    }
    return wip;
  } catch {
    return null;
  }
}

export function clearResumeWip(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WIP_KEY);
  } catch {
    /* non-fatal */
  }
}

const TARGET_KEY = "tm_target_resume"; // handoff: base resume -> audit job step
const TARGET_ID_KEY = "tm_target_resume_id"; // links the tailored version to its base resume

export function setTargetResume(text: string, id?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TARGET_KEY, text);
    if (id) window.sessionStorage.setItem(TARGET_ID_KEY, id);
    else window.sessionStorage.removeItem(TARGET_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function loadTargetResume(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(TARGET_KEY) || "";
  } catch {
    return "";
  }
}

export function loadTargetResumeId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TARGET_ID_KEY);
  } catch {
    return null;
  }
}

export function clearTargetResume(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TARGET_KEY);
    window.sessionStorage.removeItem(TARGET_ID_KEY);
  } catch {
    /* ignore */
  }
}

export async function clearSavedResume(): Promise<void> {
  if (supabaseConfigured) {
    try {
      await fetch("/api/resume", { method: "DELETE" });
    } catch {
      /* non-fatal */
    }
    return;
  }
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* non-fatal */
  }
}
