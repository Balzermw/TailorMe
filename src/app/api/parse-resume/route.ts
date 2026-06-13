import { NextResponse } from "next/server";
import { analyze, extractText } from "@/lib/apply/parse";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Parse an uploaded resume into text + heuristic stats. Works without any API
// key (local extraction), so the audit upload is real even in demo mode.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)." }, { status: 413 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const text = await extractText(file.name, bytes);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Couldn’t read any text from that file." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, stats: analyze(text) });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t parse that file. Try a PDF, Word, or text file." },
      { status: 422 },
    );
  }
}
