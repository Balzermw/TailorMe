"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, Loader2, Upload } from "lucide-react";
import { loadSavedResume, setResumeDraft, type SavedResume } from "@/lib/resume";
import { ROUTES } from "@/components/landing/data";
import { track, getSessionId } from "@/lib/track";

// Import a resume: upload a file (text extracted server-side) OR paste
// LinkedIn/resume/notes → structure into a base resume → hand off to the editor.
// An upload goes straight to structuring (no paste-box round-trip), with a clear
// loading state since structuring a full resume takes a few seconds.
export default function PasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); // structuring (LLM)
  const [uploading, setUploading] = useState(false); // extracting text from a file
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null); // extracted text awaiting a replace confirm
  const [err, setErr] = useState<string | null>(null);
  const [existingResume, setExistingResume] = useState<SavedResume | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const processing = uploading || busy;

  useEffect(() => {
    let active = true;
    loadSavedResume().then((saved) => {
      if (!active) return;
      setExistingResume(saved);
      if (saved?.text?.trim() && !saved.doc) {
        setText((current) => (current.trim() ? current : saved.text));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function existingResumeLabel() {
    return (
      existingResume?.doc?.headline ||
      existingResume?.doc?.name ||
      existingResume?.name ||
      "Saved source profile"
    );
  }

  // "Jun 26, 2026, 11:04 AM" — or null when the timestamp is missing/invalid.
  function fmtDateTime(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }

  // How the saved profile was added, in plain words.
  function sourceLabel(): string | null {
    switch (existingResume?.source) {
      case "uploaded":
        return "Uploaded file";
      case "pasted":
        return "Pasted text";
      case "scratch":
        return "Built from scratch";
      default:
        return null;
    }
  }

  // Rough size of the saved profile: exact word count + an estimated page count
  // (~475 words per page), so the user knows how much they'd be replacing.
  function lengthLabel(): string | null {
    const text = (existingResume?.text ?? "").trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words === 0) return null;
    const pages = Math.max(1, Math.round(words / 475));
    return `~${pages} page${pages === 1 ? "" : "s"} · ${words.toLocaleString()} words`;
  }

  const existingSourceEditHref = existingResume?.doc ? ROUTES.resumeEdit : ROUTES.resumeImport;
  const existingSourceEditLabel = existingResume?.doc ? "Edit source" : "Update source";

  // Structure source text → TailoredDoc → hand to the editor. Shared by the
  // paste button, the file upload, and the replace confirmation.
  async function structureText(src: string) {
    const trimmed = src.trim();
    if (trimmed.length < 40) {
      setErr("Add at least a few lines of your background first.");
      return;
    }
    setErr(null);
    setBusy(true);
    track("resume_import_start", { chars: trimmed.length });
    try {
      const res = await fetch("/api/resume/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.demo && !data.doc) {
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
      // Carry the deterministic import feedback into the editor so the
      // Suggestions panel is populated immediately; the editor persists it.
      const importedFeedback = Array.isArray(data.proofPoints) ? data.proofPoints : undefined;
      setResumeDraft(data.doc, importedFeedback, { persistOnLoad: true });
      router.push(ROUTES.resumeEdit);
    } catch {
      track("resume_import_failed");
      setErr(
        "The import service couldn't be reached from this browser. Check the local server and AI provider connection, then try again.",
      );
      setBusy(false);
    }
  }

  // Paste button: structure the textarea text (confirming a replace first).
  function go() {
    if (text.trim().length < 40) {
      setErr("Paste a few lines of your background first.");
      return;
    }
    setFileText(null); // this path uses the textarea text
    if (existingResume) {
      setErr(null);
      setShowReplaceConfirm(true);
      return;
    }
    void structureText(text);
  }

  // Upload a resume file → extract its text server-side (fast: extraction only),
  // then go straight to structuring. The paste box is left untouched.
  async function handleFile(file: File) {
    setErr(null);
    setUploadName(file.name);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume?mode=text", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      setUploading(false);
      if (!res.ok || typeof data.text !== "string" || data.text.trim().length < 40) {
        setErr(
          data.error ||
            "Couldn't read enough text from that file. Try another file, or paste your resume below.",
        );
        setUploadName(null);
        return;
      }
      if (existingResume) {
        // Confirm before replacing the saved source; hold the extracted text.
        setFileText(data.text);
        setShowReplaceConfirm(true);
        return;
      }
      await structureText(data.text);
    } catch {
      setUploading(false);
      setErr("Couldn't read that file. Check your connection and try again.");
      setUploadName(null);
    }
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-selected later
    if (file) void handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (processing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="tmB-build">
      <Link href={ROUTES.audit} className="tmB-build-back">
        <ArrowLeft size={15} /> Back
      </Link>
      <header className="tmB-build-head">
        <h1>Add your resume</h1>
        <p>Upload a PDF or Word file, or paste your LinkedIn, resume, or notes.</p>
      </header>

      {processing ? (
        <div className="tmB-processing" role="status" aria-live="polite">
          <Loader2 className="tmB-processing-spin" size={26} aria-hidden="true" />
          <b>{uploading ? "Reading your resume…" : "Structuring your resume…"}</b>
          {uploadName && <span className="tmB-processing-file">{uploadName}</span>}
          <div className="tmB-progress" aria-hidden="true">
            <span className="tmB-progress-bar" />
          </div>
        </div>
      ) : (
        <>
          {existingResume && (
            <div className="tmB-replace-card" role="status">
              <CircleAlert className="tmB-replace-icon" size={16} aria-hidden="true" />
              <div className="tmB-replace-copy">
                <b>You already have a source profile</b>
                <p>
                  {existingResumeLabel()} &middot; importing replaces it after you
                  confirm.
                </p>
              </div>
              <Link className="tmB-replace-link" href={existingSourceEditHref}>
                {existingSourceEditLabel}
              </Link>
            </div>
          )}

          <label className="tmB-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <Upload size={18} />
            <span className="tmB-dropzone-text">
              <b>{uploadName ?? "Upload a PDF or Word resume"}</b>
              <span>Drag and drop, or click to browse</span>
            </span>
            <input type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={onFileInput} hidden />
          </label>

          <div className="tmE-field">
            <label>…or paste it in</label>
            <textarea
              className="tmE-textarea"
              style={{ minHeight: 180, maxHeight: 360 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "Paste your LinkedIn experience, resume, or notes like:\n\nSupport Rep at Acme, 2021–present. ~50 tickets/day, 96% CSAT. Built the help center.\nBSc Computer Science, State University, 2020.\nSkills: Zendesk, SQL, Python"
              }
            />
          </div>

          {err && <p className="tmB-build-err">{err}</p>}

          {showReplaceConfirm && existingResume ? (
            <div className="tmB-replace-confirm" role="alert">
              <b>Replace your saved source profile?</b>
              <p>
                This import becomes your active source profile. Targeted
                applications you already created stay in your dashboard.
              </p>
              <dl className="tmB-replace-facts">
                <div>
                  <dt>Profile</dt>
                  <dd>{existingResumeLabel()}</dd>
                </div>
                {sourceLabel() && (
                  <div>
                    <dt>Added</dt>
                    <dd>{sourceLabel()}</dd>
                  </div>
                )}
                {lengthLabel() && (
                  <div>
                    <dt>Length</dt>
                    <dd>{lengthLabel()}</dd>
                  </div>
                )}
                {fmtDateTime(existingResume.createdAt) && (
                  <div>
                    <dt>Created</dt>
                    <dd>{fmtDateTime(existingResume.createdAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>Last updated</dt>
                  <dd>
                    {fmtDateTime(existingResume.savedAt) ??
                      "Not tracked for this older profile"}
                  </dd>
                </div>
              </dl>
              <div>
                <button
                  type="button"
                  className="tm-btn tm-btn--outline"
                  onClick={() => {
                    setShowReplaceConfirm(false);
                    setFileText(null);
                    setUploadName(null);
                  }}
                >
                  Keep current
                </button>
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={() => {
                    setShowReplaceConfirm(false);
                    void structureText(fileText ?? text);
                  }}
                >
                  Replace and import
                </button>
              </div>
            </div>
          ) : (
            <div className="tmB-build-actions">
              <button type="button" className="tm-btn tm-btn--primary" onClick={go}>
                Structure my resume <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
