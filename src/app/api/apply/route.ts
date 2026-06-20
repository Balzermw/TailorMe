import { NextResponse } from "next/server";
import { creditsDisabled, llmConfigured } from "@/lib/config";
import { runAudit, runFull, runScore } from "@/lib/apply/pipeline";
import { SAMPLE_RESUME } from "@/lib/apply/sample";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  FREE_AUDIT_GLOBAL_RULES,
  FREE_AUDIT_RULES,
  FULL_RUN_RULES,
  rateLimitDisabled,
  validateApplyInput,
} from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import type { ProofPoint } from "@/lib/types";

// The "what tailoring will fix" findings are computed client-side at parse time
// and POSTed here; sanitize + cap before persisting them with the application.
function sanitizeProofPoints(input: unknown): ProofPoint[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const out = input.slice(0, 12).map((p) => {
    const x = (p ?? {}) as Record<string, unknown>;
    const sev = ["high", "medium", "low"].includes(x.severity as string)
      ? (x.severity as "high" | "medium" | "low")
      : "medium";
    return {
      title: s(x.title, 140).trim(),
      summary: s(x.summary, 240).trim(),
      quote: s(x.quote, 240).trim() || undefined,
      why: s(x.why, 600).trim(),
      fix: s(x.fix, 600).trim(),
      severity: sev,
    };
  }).filter((p) => p.title);
  return out.length ? out : undefined;
}

const FREE_LIMIT_MSG =
  "You've used your free audits for now. Create a free account to run a full tailored application — your first one is free.";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  // No provider configured → client falls back to the simulated wizard.
  if (!llmConfigured) {
    return NextResponse.json({ demo: true });
  }

  let body: {
    mode?: string;
    resumeText?: string;
    postingText?: string;
    useSample?: boolean;
    proofPoints?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // "score" = fit only (1 call); "audit" = fit + the three real review agents
  // (2 calls, still free + no auth); "full" = tailored documents (auth + credit).
  const mode =
    body.mode === "full" ? "full" : body.mode === "audit" ? "audit" : "score";
  const resumeText = body.useSample
    ? SAMPLE_RESUME
    : (body.resumeText ?? "").trim();
  const postingText = (body.postingText ?? "").trim();

  if (!resumeText || !postingText) {
    return NextResponse.json(
      { error: "Resume and job posting are both required." },
      { status: 400 },
    );
  }

  // Cap input size → bounds tokens (and cost) per call.
  const sizeError = validateApplyInput(resumeText, postingText);
  if (sizeError) {
    return NextResponse.json({ error: sizeError }, { status: 413 });
  }

  try {
    // ----- free preview: fit (+ optionally the real agent audit), no auth, no credit -----
    if (mode === "score" || mode === "audit") {
      // Rate-limit the only ungated, token-spending paths: per IP + a global
      // circuit breaker capping total free spend. The agent audit costs one more
      // call than a bare score, so it shares the same free budget.
      if (!rateLimitDisabled) {
        const ip = getClientIp(request);
        const perIp = consume(`audit:${ip}`, FREE_AUDIT_RULES);
        if (!perIp.allowed) return tooManyRequests(FREE_LIMIT_MSG, perIp.resetAt);
        const global = consume("audit:global", FREE_AUDIT_GLOBAL_RULES);
        if (!global.allowed) {
          return tooManyRequests(
            "Free audits are at capacity right now — please try again shortly, or create an account.",
            global.resetAt,
          );
        }
      }
      const result =
        mode === "audit"
          ? await runAudit(resumeText, postingText)
          : await runScore(resumeText, postingText);
      return NextResponse.json({ result });
    }

    // ----- full run: requires auth + a credit -----
    const sb = await getServerSupabase();
    if (!sb) {
      // Supabase not configured (no accounts/credits) → surface the demo notice
      // instead of redirecting to a sign-in page that can't complete the run.
      return NextResponse.json({ demo: true });
    }
    const user = (await sb.auth.getUser()).data.user;
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to run a full application.", signin: true },
        { status: 401 },
      );
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();
    if (!creditsDisabled && (!profile || profile.credits <= 0)) {
      return NextResponse.json(
        { error: "You're out of credits.", needCredits: true },
        { status: 402 },
      );
    }

    // Per-account daily cap: credits bound total spend, this bounds burst rate
    // (a scripted or compromised credit-loaded account).
    if (!rateLimitDisabled) {
      const burst = consume(`full:${user.id}`, FULL_RUN_RULES);
      if (!burst.allowed) {
        return tooManyRequests(
          "You've hit today's application limit. Please try again tomorrow.",
          burst.resetAt,
        );
      }
    }

    const result = await runFull(resumeText, postingText);
    // Carry the step-1 audit findings into the stored result so the editor can
    // show "what the tailoring addressed."
    result.proofPoints = sanitizeProofPoints(body.proofPoints);

    // Spend the credit after a successful run, then persist the application.
    if (!creditsDisabled) await sb.rpc("consume_credit");
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: user.id,
        company: result.company,
        role: result.role,
        posting: postingText,
        fit_score: result.fit.overall,
        status: "ready",
        result,
      })
      .select("id")
      .single();

    return NextResponse.json({ result, applicationId: app?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "pipeline failed";
    return NextResponse.json(
      { error: `Tailoring failed: ${message}` },
      { status: 500 },
    );
  }
}
