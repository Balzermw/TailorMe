// Fit number -> a plain-language tier. Shared by the dashboard ScoreBar and the
// fit panel so the score reads as a judgement ("Strong fit") consistently, from
// a single source of truth. Pure and dependency-free, so client components can
// import it (unlike the server-only apply pipeline).

export type FitTone = "strong" | "good" | "fair" | "weak";

export interface FitTier {
  label: string;
  tone: FitTone;
}

export function fitTier(fit: number): FitTier {
  if (fit >= 80) return { label: "Strong fit", tone: "strong" };
  if (fit >= 70) return { label: "Good fit", tone: "good" };
  if (fit >= 55) return { label: "Fair fit", tone: "fair" };
  return { label: "Weak fit", tone: "weak" };
}
