import { NextResponse } from "next/server";
import { creditsDisabled, llmConfigured } from "@/lib/config";
import { runAudit, runFull, runScore } from "@/lib/apply/pipeline";
import { withAiRun } from "@/lib/apply/ai-telemetry";
import { SAMPLE_RESUME } from "@/lib/apply/sample";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  FREE_AUDIT_GLOBAL_RULES,
  FREE_AUDIT_RULES,
  FULL_RUN_RULES,
  MAX_POSTING_CHARS,
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
  "You've used your free audits for now. Create a free account to run a full tailored application. Your first one is free.";

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
    resumeId?: string; // base resume this run was launched from (for grouping)
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
  const sessionId = request.headers.get("x-tm-session");
  const resumeText = body.useSample
    ? SAMPLE_RESUME
    : (body.resumeText ?? "").trim();
  // Silently trim overly long postings (full-page LinkedIn pastes, etc.) so the
  // user still gets a real score instead of seeing the Nordpeak sample fallback.
  const postingText = (body.postingText ?? "").trim().slice(0, MAX_POSTING_CHARS);

  if (!resumeText || !postingText) {
    return NextResponse.json(
      { error: "Resume and job posting are both required." },
      { status: 400 },
    );
  }

  // Cap input size — only the resume length can still breach the limit now.
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
            "Free audits are at capacity right now. Please try again shortly, or create an account.",
            global.resetAt,
          );
        }
      }
      const result =
        mode === "audit"
          ? await withAiRun("audit", { sessionId }, () =>
              runAudit(resumeText, postingText),
            )
          : await withAiRun("score", { sessionId }, () =>
              runScore(resumeText, postingText),
            );
      return NextResponse.json({ result });
    }

    // ----- full run: requires auth + a credit -----
    const sb = await getServerSupabase();
    if (!sb) {
      // Local/dev mode has no accounts or credits, but it still needs to run
      // the same full tailoring pipeline so the user can test the draft review
      // workflow end to end. The client stores this returned result locally.
      const result = await withAiRun("tailor", { sessionId }, () =>
        runFull(resumeText, postingText),
      );
      result.proofPoints = sanitizeProofPoints(body.proofPoints);
      return NextResponse.json({ result, local: true, applicationId: null });
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

    const result = await withAiRun("tailor", { userId: user.id, sessionId }, () =>
      runFull(resumeText, postingText),
    );
    // Carry the step-1 audit findings into the stored result so the editor can
    // show "what the tailoring addressed."
    result.proofPoints = sanitizeProofPoints(body.proofPoints);

    // Link to the base resume this run came from (verify it's the user's own).
    let resumeId: string | null = null;
    if (typeof body.resumeId === "string" && body.resumeId) {
      const { data: owned } = await sb
        .from("resumes")
        .select("id")
        .eq("id", body.resumeId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (owned) resumeId = body.resumeId;
    }

    // Persist the application FIRST, then spend the credit only on a confirmed
    // insert — so a persistence failure never silently burns a paid credit.
    const { data: app, error: insertError } = await sb
      .from("applications")
      .insert({
        user_id: user.id,
        company: result.company,
        role: result.role,
        posting: postingText,
        fit_score: result.fit.overall,
        status: "ready",
        result,
        resume_id: resumeId,
      })
      .select("id")
      .single();

    // If the row couldn't be created (RLS/schema/constraint), surface a real,
    // retryable error instead of a dead end — and don't consume the credit. (We
    // can't downgrade an account user to a localStorage-only app: the account
    // editor loads from the DB, not localStorage.)
    if (insertError || !app?.id) {
      if (insertError) console.error("applications insert failed", insertError);
      return NextResponse.json(
        { error: "We couldn’t save your tailored application. Please try again." },
        { status: 500 },
      );
    }

    if (!creditsDisabled) await sb.rpc("consume_credit");
    return NextResponse.json({ result, applicationId: app.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "pipeline failed";
    return NextResponse.json(
      { error: `Tailoring failed: ${message}` },
      { status: 500 },
    );
  }
}
