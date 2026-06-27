import { NextResponse } from "next/server";
import type { ApplyResult, TailoredDoc } from "@/lib/types";
import { SAMPLE_DOC } from "@/lib/apply/sample";
import { compileToPdf, renderResumeTex } from "@/lib/apply/latex";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Compiled PDF of the tailored resume. When LATEX_COMPILE_URL is set, the
// moderncv LaTeX is compiled to a real PDF on your own infrastructure; without
// it, redirect to the in-app print view (browser "Save as PDF").
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let doc: TailoredDoc | null = null;
  if (id === "sample") {
    doc = SAMPLE_DOC;
  } else {
    const sb = await getServerSupabase();
    const app = sb
      ? (await sb.from("applications").select("result").eq("id", id).single()).data
      : null;
    doc = ((app?.result ?? null) as ApplyResult | null)?.doc ?? null;
  }

  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const pdf = await compileToPdf(renderResumeTex(doc));
    if (pdf) {
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="Resume.pdf"',
        },
      });
    }
  } catch {
    /* fall through to the print view */
  }
  // No compiler configured (or it failed) → the browser-printable view, which
  // auto-opens the Save-as-PDF dialog (?print=1).
  return NextResponse.redirect(new URL(`/applications/${id}/print?print=1`, request.url));
}
