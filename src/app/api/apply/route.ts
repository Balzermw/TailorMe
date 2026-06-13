import { NextResponse } from "next/server";
import { anthropicConfigured } from "@/lib/config";
import { runFull, runScore } from "@/lib/apply/pipeline";
import { SAMPLE_RESUME } from "@/lib/apply/sample";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  // Not configured → client falls back to the simulated wizard.
  if (!anthropicConfigured) {
    return NextResponse.json({ demo: true });
  }

  let body: {
    mode?: string;
    resumeText?: string;
    postingText?: string;
    useSample?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const mode = body.mode === "full" ? "full" : "score";
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

  try {
    // ----- free preview: fit only, no auth, no credit -----
    if (mode === "score") {
      const result = await runScore(resumeText, postingText);
      return NextResponse.json({ result });
    }

    // ----- full run: requires auth + a credit -----
    const sb = await getServerSupabase();
    const user = sb ? (await sb.auth.getUser()).data.user : null;
    if (!sb || !user) {
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
    if (!profile || profile.credits <= 0) {
      return NextResponse.json(
        { error: "You're out of credits.", needCredits: true },
        { status: 402 },
      );
    }

    const result = await runFull(resumeText, postingText);

    // Spend the credit after a successful run, then persist the application.
    await sb.rpc("consume_credit");
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
