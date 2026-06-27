import type { TailoredDoc } from "@/lib/types";

const DURATION_PART = String.raw`(?:(?:a|an|\d+)\s*)?(?:yrs?|years?|mos?|months?)`;
const DURATION_PHRASE = String.raw`(?:less\s+than\s+)?${DURATION_PART}(?:\s+${DURATION_PART})*`;
const DATE_ANCHOR = /\b(?:present|current|now|ongoing|(?:19|20)\d{2})\b/i;

const DURATION_SUFFIXES = [
  new RegExp(String.raw`\s*[\u00b7\u2022|]\s*${DURATION_PHRASE}\s*$`, "i"),
  new RegExp(String.raw`\s*\(\s*${DURATION_PHRASE}\s*\)\s*$`, "i"),
  new RegExp(String.raw`\s+${DURATION_PHRASE}\s*$`, "i"),
];

export function cleanResumeDate(value: string | undefined): string {
  let out = (value ?? "").trim();
  if (!out || !DATE_ANCHOR.test(out)) return out;
  for (const suffix of DURATION_SUFFIXES) {
    out = out.replace(suffix, "").trim();
  }
  return out.replace(/\s+/g, " ");
}

export function cleanResumeDocDates(doc: TailoredDoc): TailoredDoc {
  return {
    ...doc,
    experience: (doc.experience ?? []).map((entry) => ({
      ...entry,
      dates: cleanResumeDate(entry.dates),
    })),
    education: doc.education?.map((entry) => ({
      ...entry,
      dates: cleanResumeDate(entry.dates),
    })),
    certifications: doc.certifications?.map((entry) => ({
      ...entry,
      date: cleanResumeDate(entry.date),
    })),
  };
}
