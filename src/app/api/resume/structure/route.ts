import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { structureResume } from "@/lib/apply/pipeline";
import { withAiRun } from "@/lib/apply/ai-telemetry";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, MAX_RESUME_CHARS, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { refineFeedback } from "@/lib/resume-rules/deterministicFeedback";
import type { ProofPoint, TailoredDoc } from "@/lib/types";

// Deterministic feedback for the just-structured doc so the editor's Suggestions
// section is populated immediately after import (no LLM, no token cost). Safe to
// call on any doc — refineFeedback returns [] if it can't render.
function importFeedback(doc: TailoredDoc): ProofPoint[] {
  return refineFeedback(doc, []).proofPoints;
}

// Paste-import: turn pasted resume/LinkedIn/notes text into a structured base
// resume (TailoredDoc) the user can edit. No posting, no scoring, no credit.

export const runtime = "nodejs";
export const maxDuration = 60;

function structureFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (
    /fetch failed|connection|network|ECONN|ENOTFOUND|ETIMEDOUT|timeout|socket/i.test(
      message,
    )
  ) {
    return (
      "The AI import service is configured, but this environment can't reach the " +
      "provider right now. Check outbound HTTPS/API provider access, then try again."
    );
  }
  return (
    "The AI import service failed before it could return a structured source " +
    "profile. Try again, or use the manual builder while the provider is unavailable."
  );
}

const SECTION_HEADINGS = new Set([
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "licenses",
  "summary",
  "about",
  "resources",
]);

const LINKEDIN_NOISE = [
  /^home$/i,
  /^my network$/i,
  /^jobs$/i,
  /^messaging$/i,
  /^notifications?$/i,
  /^for business$/i,
  /^advertise$/i,
  /^resources$/i,
  /^scroll quick replies/i,
  /^reply to conversation/i,
  /^maximize compose field/i,
  /^attach (an image|a file)/i,
  /^open (gif|emoji) keyboard/i,
  /^open send options$/i,
  /^send$/i,
  /^best regards[,]?$/i,
  /^yes, interested/i,
  /^no thanks/i,
];

const DATE_RANGE =
  /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*(?:-|–|—|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|present|current|now)|\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b/i;

function cleanImportLines(text: string): string[] {
  const seen = new Set<string>();
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^[•*\-–—\s]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .filter((line) => !LINKEDIN_NOISE.some((pattern) => pattern.test(line)))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 220);
}

function isLikelyName(line: string, previous?: string): boolean {
  if (previous && /best regards|regards/i.test(previous)) return false;
  if (/[0-9@|:/]/.test(line)) return false;
  if (SECTION_HEADINGS.has(line.toLowerCase())) return false;
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[A-Z][a-z'.-]+$/.test(word));
}

function isLikelyHeadline(line: string): boolean {
  if (line.length > 180 || /@.+\.[a-z]{2,}/i.test(line)) return false;
  return /engineer|manager|consultant|advisor|architect|developer|analyst|specialist|director|designer|coordinator|administrator|support|sales|product|operations/i.test(
    line,
  );
}

function splitList(value: string): string[] {
  return value
    .split(/[,;|•]|\band\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length <= 80);
}

function isSectionHeading(line: string): boolean {
  return SECTION_HEADINGS.has(line.toLowerCase());
}

function nextSectionIndex(lines: string[], start: number): number {
  const found = lines.findIndex((line, index) => index > start && isSectionHeading(line));
  return found >= 0 ? found : lines.length;
}

function extractSkills(lines: string[]): string[] {
  const skills = new Map<string, string>();
  lines.forEach((line, index) => {
    const inline = /^skills?\s*[:\-]\s*(.+)$/i.exec(line)?.[1];
    const source =
      inline ||
      (line.toLowerCase() === "skills" && lines[index + 1]?.includes(",")
        ? lines[index + 1]
        : line.includes(",") && splitList(line).length >= 4
          ? line
          : "");
    if (!source) return;
    for (const skill of splitList(source)) {
      const key = skill.toLowerCase();
      if (!skills.has(key)) skills.set(key, skill);
    }
  });
  return Array.from(skills.values()).slice(0, 48);
}

function extractContact(lines: string[]): string {
  const joined = lines.join(" ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = joined.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];
  const linkedin = joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,)]+/i)?.[0];
  return [phone, email, linkedin].filter(Boolean).join(" | ");
}

function fallbackStructureResume(text: string): TailoredDoc | null {
  const lines = cleanImportLines(text);
  if (lines.length < 3) return null;

  const nameIndex = lines.findIndex((line, index) => isLikelyName(line, lines[index - 1]));
  const name = nameIndex >= 0 ? lines[nameIndex] : "";
  const educationIndex = lines.findIndex((line) => /^education$/i.test(line));
  const headline =
    lines.slice(Math.max(0, nameIndex + 1), nameIndex >= 0 ? nameIndex + 6 : 12).find(isLikelyHeadline) ??
    lines.find(isLikelyHeadline) ??
    "";
  const dateIndex = lines.findIndex((line, index) => {
    if (!DATE_RANGE.test(line)) return false;
    return educationIndex < 0 || index < educationIndex;
  });
  const firstDate = dateIndex >= 0 ? lines[dateIndex] : "";
  const skills = extractSkills(lines);
  const contact = extractContact(lines);
  const summary =
    lines.find(
      (line) =>
        line.length >= 30 &&
        line.length <= 500 &&
        !line.includes("@") &&
        !DATE_RANGE.test(line) &&
        !line.includes(",") &&
        !isSectionHeading(line) &&
        line !== name &&
        line !== headline,
    ) ?? "";
  const role =
    dateIndex >= 2 && !isSectionHeading(lines[dateIndex - 2]) ? lines[dateIndex - 2] : headline;
  const company =
    dateIndex >= 1 && !isSectionHeading(lines[dateIndex - 1]) ? lines[dateIndex - 1] : "";
  const bulletStart = dateIndex >= 0 ? dateIndex + 1 : Math.max(nameIndex + 1, 0);
  const bulletEnd = nextSectionIndex(lines, bulletStart - 1);
  const excluded = new Set([name, headline, firstDate, summary, role, company, "Skills", "skills"]);
  const bullets = lines
    .slice(bulletStart, bulletEnd)
    .filter((line) => !excluded.has(line))
    .filter((line) => !isSectionHeading(line))
    .filter((line) => !line.includes("@"))
    .filter((line) => !DATE_RANGE.test(line))
    .filter((line) => splitList(line).length < 4)
    .filter((line) => line.length >= 8 && line.length <= 180)
    .slice(0, 8);

  const educationLines =
    educationIndex >= 0 ? lines.slice(educationIndex + 1, nextSectionIndex(lines, educationIndex)) : [];
  const educationDate = educationLines.find((line) => /\b(?:19|20)\d{2}\b/.test(line)) ?? "";
  const educationText = educationLines.filter((line) => line !== educationDate);
  const degree =
    educationText.find((line) => /\b(ba|bs|bsc|bachelor|master|mba|phd|degree|minor|major)\b/i.test(line)) ??
    "";
  const school =
    educationText.find((line) => line !== degree && /\b(university|college|school|institute|csus)\b/i.test(line)) ??
    educationText.find((line) => line !== degree) ??
    "";

  const doc: TailoredDoc = {
    name,
    headline,
    contact,
    summary,
    experience:
      role || company || firstDate || bullets.length
        ? [
            {
              role,
              company,
              dates: firstDate,
              bullets,
            },
          ]
        : [],
    education: degree || school
      ? [{ school, degree, dates: educationDate }]
      : [],
    projects: [],
    certifications: [],
    skills,
    coverLetter: "",
  };
  return doc.name || doc.experience.length ? doc : null;
}

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (body.text ?? "").trim().slice(0, MAX_RESUME_CHARS);
  if (text.length < 40) {
    return NextResponse.json(
      { error: "Paste a bit more, at least a few lines of your background." },
      { status: 400 },
    );
  }

  const fallbackDoc = fallbackStructureResume(text);
  if (!llmConfigured) {
    if (!fallbackDoc) {
      return NextResponse.json(
        { error: "Couldn't read a resume from that text. Add a bit more detail." },
        { status: 422 },
      );
    }
    return NextResponse.json({
      fallback: true,
      doc: fallbackDoc,
      proofPoints: importFeedback(fallbackDoc),
      warning: "AI import is not configured locally, so this was structured with a local fallback.",
    });
  }

  const sb = await getServerSupabase();
  const userId = sb ? (await sb.auth.getUser()).data.user?.id ?? null : null;
  const sessionId = request.headers.get("x-tm-session");

  if (!rateLimitDisabled) {
    const res = consume(
      `resume-structure:${userId ?? getClientIp(request)}`,
      EDIT_REVIEW_RULES,
    );
    if (!res.allowed) {
      return tooManyRequests(
        "You're importing very fast. Give it a minute.",
        res.resetAt,
      );
    }
  }

  try {
    const doc = await withAiRun("structure", { userId, sessionId }, () =>
      structureResume(text),
    );
    if (!doc) {
      return NextResponse.json(
        { error: "Couldn't read a resume from that text. Add a bit more detail." },
        { status: 422 },
      );
    }
    return NextResponse.json({ doc, proofPoints: importFeedback(doc) });
  } catch (err) {
    console.error(
      "[resume/structure] failed:",
      err instanceof Error ? err.message : err,
    );
    if (fallbackDoc) {
      return NextResponse.json({
        fallback: true,
        doc: fallbackDoc,
        proofPoints: importFeedback(fallbackDoc),
        warning: structureFailureMessage(err),
      });
    }
    return NextResponse.json(
      { error: structureFailureMessage(err) },
      { status: 502 },
    );
  }
}
