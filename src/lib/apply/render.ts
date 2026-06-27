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

/** Path to the printable (Save-as-PDF) moderncv view of an application.
 *  Pass autoPrint to open the browser Save-as-PDF dialog on arrival. */
export function printHref(applicationId: string, autoPrint = false): string {
  return `/applications/${applicationId}/print${autoPrint ? "?print=1" : ""}`;
}

/** Compiled moderncv PDF (falls back to the print view when no compiler is set). */
export function pdfHref(applicationId: string): string {
  return `/api/applications/${applicationId}/pdf`;
}

/** Downloadable moderncv LaTeX source. */
export function texHref(applicationId: string, type?: "cover"): string {
  return `/api/applications/${applicationId}/latex${type ? `?type=${type}` : ""}`;
}

/** The resume editor for a tailored application (review/accept/edit changes). */
export function editHref(applicationId: string): string {
  return `/applications/${applicationId}/edit`;
}
