"use client";

// Saved-resume store for the "upload once" flow. Real mode persists to the
// user's account via /api/resume (RLS-scoped); demo mode persists to
// localStorage so the flow still works without Supabase. All calls are
// best-effort — a signed-out or failed save is a silent no-op.

import type { ResumeStats, TailoredDoc } from "@/lib/types";
import { supabaseConfigured } from "@/lib/config";
import { docToResumeText } from "@/lib/apply/serialize";

export interface SavedResume {
  name: string;
  text: string;
  stats: ResumeStats | null;
  doc?: TailoredDoc | null; // structured base resume (build-from-scratch / editor)
  source?: string; // 'uploaded' | 'scratch' | 'pasted'
  savedAt?: string;
}

const LS_KEY = "tm_resume_v1";

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
    return raw ? (JSON.parse(raw) as SavedResume) : null;
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
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...resume, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

const DRAFT_KEY = "tm_resume_draft"; // sessionStorage handoff: builder -> editor

function writeLocalDoc(doc: TailoredDoc, source?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prev = window.localStorage.getItem(LS_KEY);
    const base = prev ? (JSON.parse(prev) as SavedResume) : null;
    const saved: SavedResume = {
      name: doc.name || base?.name || "My resume",
      text: docToResumeText(doc),
      stats: base?.stats ?? null,
      doc,
      source: source ?? base?.source ?? "scratch",
      savedAt: new Date().toISOString(),
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
): Promise<{ ok: boolean; error?: string }> {
  if (supabaseConfigured) {
    try {
      const res = await fetch("/api/resume/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source ? { doc, source } : { doc }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && !data.local) return { ok: true }; // saved to the account
      // anon in live mode (data.local) or a soft error → keep it in the browser
    } catch {
      /* offline → fall back to localStorage */
    }
  }
  return writeLocalDoc(doc, source)
    ? { ok: true }
    : { ok: false, error: "Couldn't save your resume." };
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

export function setResumeDraft(doc: TailoredDoc): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

export function clearResumeDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
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
