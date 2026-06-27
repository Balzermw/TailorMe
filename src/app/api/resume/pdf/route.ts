import { NextResponse } from "next/server";
import type { TailoredDoc } from "@/lib/types";
import { compileToPdf, renderResumeTex } from "@/lib/apply/latex";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Compiled PDF of the base resume. When LATEX_COMPILE_URL is set, the moderncv
// LaTeX is compiled on your own infra; otherwise (or for anon users whose resume
// lives in localStorage) we fall back to the in-app print view ("Save as PDF").
// Mirrors /api/applications/[id]/pdf.
export async function GET(request: Request) {
  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  let doc: TailoredDoc | null = null;
  if (sb && user) {
    const { data } = await sb
      .from("resumes")
      .select("doc")
      .eq("user_id", user.id)
      .maybeSingle();
    doc = (data?.doc ?? null) as TailoredDoc | null;
  }

  if (doc) {
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
  }
  // No server doc (anon) or no compiler → the browser-printable view, which
  // auto-opens the Save-as-PDF dialog (?print=1).
  return NextResponse.redirect(new URL("/resume/print?print=1", request.url));
}
