import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import { llmConfigured } from "@/lib/config";
import { parseResume } from "@/lib/apply/pipeline";
import { extractLatexResumeSections } from "@/lib/resume-rules/extractLatexResumeSections";
import { evaluateResumeRules } from "@/lib/resume-rules/evaluateResumeRules";
import type { ProofPoint } from "@/lib/types";

// Rule Lab comparison endpoint: runs the deterministic rules engine, the legacy
// LLM feedback (parseResume), and the combined+deduped result on the SAME
// résumé, so we can see what each surfaces side by side. Admin-only in prod;
// open in dev for local iteration. Does not persist any résumé/job text.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getServerUser();
  const allowed = process.env.NODE_ENV !== "production" || isAdminEmail(user?.email);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { latexSource?: string; resumeText?: string; jobText?: string; tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const latexSource = (body.latexSource ?? body.resumeText ?? "").trim();
  if (!latexSource) return NextResponse.json({ error: "Provide latexSource." }, { status: 400 });
  const tier = body.tier === "paid" ? "paid" : "free";

  // Deterministic-only (zero LLM).
  const deterministic = evaluateResumeRules({ latexSource, jobText: body.jobText, tier });

  // Legacy LLM feedback — reuse parseResume on readable text from the LaTeX.
  let proofPoints: ProofPoint[] = [];
  let llmError: string | null = null;
  if (llmConfigured) {
    try {
      const parsed = extractLatexResumeSections(latexSource);
      const text =
        parsed.headerText +
        "\n\n" +
        parsed.sections.map((s) => `${s.name}\n${s.items.map((i) => `- ${i.text}`).join("\n")}`).join("\n\n");
      const stats = await parseResume(text || latexSource);
      proofPoints = (stats.proofPoints ?? []) as ProofPoint[];
    } catch (e) {
      llmError = e instanceof Error ? e.name : "llm_error";
    }
  }

  // Combined: fold the LLM findings in + dedupe against the deterministic ones.
  const combined = evaluateResumeRules({
    latexSource,
    jobText: body.jobText,
    tier,
    legacyProofPoints: proofPoints,
  });

  const titles = (r: typeof deterministic) =>
    r.surfaced.map((f) => ({
      title: f.title,
      ruleId: f.ruleId,
      severity: f.uiSeverityLabel,
      group: f.priorityGroup,
      sources: f.sourceRuleIds,
    }));

  return NextResponse.json({
    tier,
    llmConfigured,
    llmError,
    deterministic: { stats: deterministic.stats, surfaced: titles(deterministic) },
    llm: {
      proofPointCount: proofPoints.length,
      proofPoints: proofPoints.map((p) => ({ title: p.title, severity: p.severity })),
    },
    combined: {
      stats: combined.stats,
      surfaced: titles(combined),
      ui: combined.ui,
    },
  });
}
