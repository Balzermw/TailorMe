"use client";

// Saved-resume store for the "upload once" flow. Real mode persists to the
// user's account via /api/resume (RLS-scoped); demo mode persists to
// localStorage so the flow still works without Supabase. All calls are
// best-effort — a signed-out or failed save is a silent no-op.

import type { ResumeStats } from "@/lib/types";
import { supabaseConfigured } from "@/lib/config";

export interface SavedResume {
  name: string;
  text: string;
  stats: ResumeStats | null;
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
