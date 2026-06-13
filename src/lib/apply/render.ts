import type { TailoredDoc } from "@/lib/types";

// Swappable document-rendering seam. Today the app renders the tailored
// document as a print-styled HTML page (/applications/[id]/print) that the
// browser turns into a PDF via "Save as PDF". A future moderncv/LaTeX
// renderer (e.g. in a Managed-Agents container) can implement the same
// interface and produce a binary PDF without touching callers.
export interface ResumeRenderer {
  /** Resume + cover letter for a tailored document, as a downloadable artifact. */
  render(doc: TailoredDoc): Promise<{ url: string } | { html: string }>;
}

/** Path to the printable (Save-as-PDF) view of a persisted application. */
export function printHref(applicationId: string): string {
  return `/applications/${applicationId}/print`;
}
