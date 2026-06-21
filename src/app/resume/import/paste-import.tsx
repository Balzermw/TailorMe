"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { setResumeDraft } from "@/lib/resume";
import { ROUTES } from "@/components/landing/data";

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
    try {
      const res = await fetch("/api/resume/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.demo) {
        setErr("Importing needs AI configured in this environment.");
        setBusy(false);
        return;
      }
      if (!res.ok || !data.doc) {
        setErr(data.error || "Couldn't import that. Try again.");
        setBusy(false);
        return;
      }
      setResumeDraft(data.doc); // hand the structured doc to the editor
      router.push(ROUTES.resumeEdit);
    } catch {
      setErr("Couldn't import that. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="tmB-build">
      <header className="tmB-build-head">
        <h1>Paste what you have</h1>
        <p>
          Drop in your LinkedIn “About” + experience, an old resume, or rough notes about
          your jobs and skills. We’ll structure it into a resume you can edit — and we won’t
          invent anything that isn’t in your text.
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
    </div>
  );
}
