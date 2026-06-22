import type { TailoredDoc } from "@/lib/types";
import { docToResumeText } from "./serialize";

// Cheap, deterministic content hash (FNV-1a). Not cryptographic — just a stable
// fingerprint to tell whether an AI input changed, so we can skip re-running the
// model (and spending tokens) when it hasn't.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// Fingerprint of the résumé content that FEEDBACK depends on. Feedback is
// parseResume(docToResumeText(doc)), so hashing that exact serialized text means
// the same content → same review → reuse the cached result, no tokens. Template
// and cover letter are intentionally excluded (docToResumeText omits them).
export function feedbackHash(doc: TailoredDoc): string {
  return fnv1a(docToResumeText(doc));
}
