import { NextResponse } from "next/server";
import type { ApplyResult, TailoredDoc } from "@/lib/types";
import { SAMPLE_DOC } from "@/lib/apply/sample";
import { renderCoverTex, renderResumeTex } from "@/lib/apply/latex";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Download the real moderncv LaTeX source for an application's resume (default)
// or cover letter (?type=cover). Sample id is public; real apps are RLS-scoped.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const type = new URL(request.url).searchParams.get("type");

  let doc: TailoredDoc | null = null;
  let company = "";
  if (id === "sample") {
    doc = SAMPLE_DOC;
    company = "Nordpeak Systems";
  } else {
    const sb = await getServerSupabase();
    const app = sb
      ? (
          await sb
            .from("applications")
            .select("company,result")
            .eq("id", id)
            .single()
        ).data
      : null;
    doc = ((app?.result ?? null) as ApplyResult | null)?.doc ?? null;
    company = app?.company ?? "";
  }

  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const tex =
    type === "cover" ? renderCoverTex(doc, company) : renderResumeTex(doc);
  const filename =
    type === "cover" ? "Cover_letter.tex" : "Resume.tex";

  return new NextResponse(tex, {
    headers: {
      "Content-Type": "application/x-tex; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
