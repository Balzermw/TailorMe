"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { setResumeDraft } from "@/lib/resume";
import { ROUTES } from "@/components/landing/data";
import { track, getSessionId } from "@/lib/track";

// Paste-import: drop in LinkedIn/old-resume/notes text → structure into a base
// resume → hand off to the editor (same draft handoff the builder uses).
export default function PasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (text.trim().length < 40) {
      setErr("Paste a few lines of your background first.");
      return;
    }
    setErr(null);
    setBusy(true);
    track("resume_import_start", { chars: text.trim().length });
    try {
      const res = await fetch("/api/resume/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.demo) {
        setErr("Importing needs AI configured in this environment.");
        setBusy(false);
        return;
      }
      if (!res.ok || !data.doc) {
        track("resume_import_failed");
        setErr(data.error || "Couldn't import that. Try again.");
        setBusy(false);
        return;
      }
      track("resume_import_success");
      setResumeDraft(data.doc); // hand the structured doc to the editor
      router.push(ROUTES.resumeEdit);
    } catch {
      track("resume_import_failed");
      setErr("Couldn't import that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="tmB-build">
      <Link href={ROUTES.audit} className="tmB-build-back">
        <ArrowLeft size={15} /> Back
      </Link>
      <header className="tmB-build-head">
        <h1>Paste what you have</h1>
        <p>
          Paste a LinkedIn “About”, an old resume, or rough notes. We’ll structure it
          and never invent anything.
        </p>
      </header>
      <div className="tmE-field">
        <label>Your background</label>
        <textarea
          className="tmE-textarea"
          style={{ minHeight: 260 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Paste your LinkedIn experience, or notes like:\n\nSupport Rep at Acme, 2021–present. ~50 tickets/day, 96% CSAT. Built the help center.\nBSc Computer Science, State University, 2020.\nSkills: Zendesk, SQL, Python"
          }
        />
      </div>
      {err && <p className="tmB-build-err">{err}</p>}
      <div className="tmB-build-actions">
        <button
          type="button"
          className="tm-btn tm-btn--primary tm-btn--lg"
          onClick={() => void go()}
          disabled={busy}
        >
          {busy ? "Structuring…" : "Structure my resume"} <ArrowRight size={16} />
        </button>
      </div>
      {busy && (
        <div style={{ marginTop: 16, maxWidth: 420 }}>
          <style>{`@keyframes tmIbar{0%{left:-45%}100%{left:100%}}`}</style>
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              height: "4px",
              borderRadius: "3px",
              overflow: "hidden",
              background: "var(--tm-blue-50)",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "45%",
                borderRadius: "3px",
                background: "var(--tm-blue-600)",
                animation: "tmIbar 1.1s ease-in-out infinite",
              }}
            />
          </div>
          <p className="tm-small" style={{ marginTop: 8, fontSize: "12.5px", color: "var(--tm-zinc)" }}>
            Reading your background and structuring it into a resume. This can take a few seconds.
          </p>
        </div>
      )}
    </div>
  );
}
