import "server-only";

// The single resume template we render (moderncv banking). Feedback on a doc we
// render in OUR template must not criticize layout/spacing/fonts/section order/
// header/columns — the template owns those — so it stays focused on content.
// (The uploaded-resume parse path does NOT use these rules: there, formatting
// and ATS-parsing findings are genuine, since we don't control that file.)
export const TEMPLATE_ID = "moderncv-banking";

export const templateFeedbackRules =
  "IMPORTANT - TEMPLATE CONTEXT: this resume is rendered in a fixed, " +
  "professionally designed template. The template controls the single-column " +
  "layout, fonts, spacing, margins, section order, and header style - the " +
  "candidate does not. Do NOT raise any feedback about visual formatting, " +
  "layout, spacing, fonts, section ordering, the header, the use of columns, or " +
  "ATS-parsing risks that come from formatting; the template already handles all " +
  "of that. Focus ONLY on the CONTENT the candidate wrote: vague bullets, " +
  "activity stated without a result, missing quantification, unclear scope, " +
  "missing role-relevant skills or keywords, repetition, cliches, grammar, and " +
  "sections that are too thin or too long.";

export function withTemplateRules(system: string): string {
  return `${system}\n\n${templateFeedbackRules}`;
}
