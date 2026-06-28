"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock,
  Info,
  Link2,
  Upload,
  X,
} from "lucide-react";
import {
  clearResumeWip,
  loadResumeWip,
  loadSavedResume,
  saveResumeWip,
  setResumeDraft,
  type SavedResume,
} from "@/lib/resume";
import { ROUTES } from "@/components/landing/data";
import { track, getSessionId } from "@/lib/track";
import type { TailoredDoc } from "@/lib/types";
import ResumeScanLoader, { type ScanPhase } from "./scan-loader";

// Import a resume: paste text, upload a file (text extracted server-side), or
// pull from a link (LinkedIn/portfolio, best-effort, falls back to paste) →
// structure into a base resume → hand off to the editor. A staged scan loader
// animates the parse and ends on a checkmark before the editor opens.
export default function PasteImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null); // extracted text awaiting a replace confirm
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); // neutral guidance (e.g. LinkedIn fell back)
  const [existingResume, setExistingResume] = useState<SavedResume | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  // Staged scan loader (skeleton -> real doc reveal -> checkmark).
  const [phase, setPhase] = useState<ScanPhase | null>(null);
  const [scanDoc, setScanDoc] = useState<TailoredDoc | null>(null);

  // Import-from-link modal.
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  // "Pick up where you left off" (unstructured in-progress paste).
  const [wipText, setWipText] = useState<string | null>(null);
  const wipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    loadSavedResume().then((saved) => {
      if (!active) return;
      setExistingResume(saved);
      if (saved?.text?.trim() && !saved.doc) {
        setText((current) => (current.trim() ? current : saved.text));
      }
      // Offer to restore an in-progress paste only when the box is otherwise empty.
      const wip = loadResumeWip();
      if (wip) setWipText(wip.text);
    });
    return () => {
      active = false;
    };
  }, []);

  // Debounce-persist the paste box so a return visit can resume it.
  function onText(next: string) {
    setText(next);
    setWipText(null); // the user is actively typing; hide the restore card
    if (wipTimer.current) clearTimeout(wipTimer.current);
    wipTimer.current = setTimeout(() => saveResumeWip(next), 600);
  }

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
  // paste button, the file upload, the link import, and the replace confirmation.
  async function structureText(src: string) {
    const trimmed = src.trim();
    if (trimmed.length < 40) {
      setErr("Add at least a few lines of your background first.");
      return;
    }
    setErr(null);
    setNotice(null);
    setPhase("structuring");
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
        setPhase(null);
        return;
      }
      if (!res.ok || !data.doc) {
        track("resume_import_failed");
        setErr(data.error || "Couldn't import that. Try again.");
        setPhase(null);
        return;
      }
      track("resume_import_success");
      // Carry the deterministic import feedback into the editor so the
      // Suggestions panel is populated immediately; the editor persists it.
      const importedFeedback = Array.isArray(data.proofPoints) ? data.proofPoints : undefined;
      setResumeDraft(data.doc, importedFeedback, { persistOnLoad: true });
      clearResumeWip(); // imported successfully — drop the in-progress copy
      // Reveal the real parsed doc + checkmark, then open the editor.
      setScanDoc(data.doc as TailoredDoc);
      setPhase("done");
      setTimeout(() => router.push(ROUTES.resumeEdit), 950);
    } catch {
      track("resume_import_failed");
      setErr(
        "The import service couldn't be reached from this browser. Check the local server and AI provider connection, then try again.",
      );
      setPhase(null);
    }
  }

  // Hold extracted/fetched text for a replace confirm if a profile exists, else
  // structure it straight away. Shared by upload + link import.
  function importExtractedText(extracted: string) {
    if (existingResume) {
      setFileText(extracted);
      setShowReplaceConfirm(true);
      return;
    }
    void structureText(extracted);
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
    setNotice(null);
    setUploadName(file.name);
    setPhase("reading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume?mode=text", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.text !== "string" || data.text.trim().length < 40) {
        setErr(
          data.error ||
            "Couldn't read enough text from that file. Try another file, or paste your resume below.",
        );
        setUploadName(null);
        setPhase(null);
        return;
      }
      if (existingResume) {
        setFileText(data.text); // confirm before replacing the saved source
        setShowReplaceConfirm(true);
        setPhase(null);
        return;
      }
      await structureText(data.text);
    } catch {
      setPhase(null);
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
    if (phase) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  // Import from a link (LinkedIn / portfolio). Best-effort: the server tries to
  // read the page; LinkedIn usually serves a login wall, so we fall back to
  // guided paste rather than structuring junk.
  async function importFromLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\/|\./.test(url)) {
      setLinkErr("Paste a full profile link (https://www.linkedin.com/in/you).");
      return;
    }
    setLinkErr(null);
    setLinkBusy(true);
    try {
      const res = await fetch("/api/resume/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
        body: JSON.stringify({ url: url.startsWith("http") ? url : `https://${url}` }),
      });
      const data = await res.json().catch(() => ({}));
      setLinkBusy(false);
      if (res.ok && typeof data.text === "string" && data.text.trim().length >= 40) {
        track("resume_import_link_success");
        setShowLinkModal(false);
        setLinkUrl("");
        importExtractedText(data.text);
        return;
      }
      // Blocked (login wall) or unreadable → guide the user to paste instead.
      track("resume_import_link_fallback");
      setShowLinkModal(false);
      setLinkUrl("");
      setNotice(
        "We couldn't read that link automatically (LinkedIn blocks it). Open your profile, select all, copy, and paste it in the box below.",
      );
    } catch {
      setLinkBusy(false);
      setLinkErr("Couldn't reach that link. Try again, or paste your profile below.");
    }
  }

  if (phase) {
    return (
      <div className="tmB-build">
        <ResumeScanLoader phase={phase} doc={scanDoc} fileName={uploadName} />
      </div>
    );
  }

  return (
    <div className="tmB-build">
      <Link href={ROUTES.audit} className="tmB-build-back">
        <ArrowLeft size={15} /> Back
      </Link>
      <header className="tmB-build-head">
        <h1>Add your resume</h1>
        <p>Upload a PDF or Word file, import from a link, or paste your LinkedIn, resume, or notes.</p>
      </header>

      {wipText && !text.trim() && (
        <div className="tmB-continue" role="status">
          <Clock className="tmB-continue-icon" size={16} aria-hidden="true" />
          <div className="tmB-continue-copy">
            <b>Pick up where you left off</b>
            <p>You have an unfinished paste from a previous visit.</p>
          </div>
          <button
            type="button"
            className="tm-btn tm-btn--primary tm-btn--sm"
            onClick={() => {
              setText(wipText);
              setWipText(null);
            }}
          >
            Continue
          </button>
          <button
            type="button"
            className="tmB-continue-dismiss"
            aria-label="Dismiss"
            onClick={() => {
              clearResumeWip();
              setWipText(null);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {existingResume && (
        <div className="tmB-replace-card" role="status">
          <CircleAlert className="tmB-replace-icon" size={16} aria-hidden="true" />
          <div className="tmB-replace-copy">
            <b>You already have a source profile</b>
            <p>{existingResumeLabel()} &middot; importing replaces it after you confirm.</p>
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

      <button type="button" className="tmB-linkbtn" onClick={() => setShowLinkModal(true)}>
        <Link2 size={16} /> Import from LinkedIn or a link
      </button>

      <div className="tmE-field">
        <label>…or paste it in</label>
        <textarea
          className="tmE-textarea"
          style={{ minHeight: 180, maxHeight: 360 }}
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={
            "Paste your LinkedIn experience, resume, or notes like:\n\nSupport Rep at Acme, 2021–present. ~50 tickets/day, 96% CSAT. Built the help center.\nBSc Computer Science, State University, 2020.\nSkills: Zendesk, SQL, Python"
          }
        />
      </div>

      {notice && (
        <p className="tmB-build-notice">
          <Info size={15} aria-hidden="true" /> {notice}
        </p>
      )}
      {err && <p className="tmB-build-err">{err}</p>}

      {showReplaceConfirm && existingResume ? (
        <div className="tmB-replace-confirm" role="alert">
          <b>Replace your saved source profile?</b>
          <p>
            This import becomes your active source profile. Targeted applications you already created
            stay in your dashboard.
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
              <dd>{fmtDateTime(existingResume.savedAt) ?? "Not tracked for this older profile"}</dd>
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

      {showLinkModal && (
        <div
          className="tmB-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Import from a link"
          onClick={() => !linkBusy && setShowLinkModal(false)}
        >
          <div className="tmB-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tmB-modal-close"
              aria-label="Close"
              onClick={() => !linkBusy && setShowLinkModal(false)}
            >
              <X size={16} />
            </button>
            <div className="tmB-modal-icon">
              <Link2 size={22} />
            </div>
            <h2>Import from a link</h2>
            <p>Paste your LinkedIn profile or a personal site. We will read what we can.</p>
            <div className="tmE-field">
              <label>Profile link</label>
              <input
                className="tmE-input"
                type="url"
                inputMode="url"
                autoFocus
                placeholder="https://www.linkedin.com/in/you"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && importFromLink()}
              />
            </div>
            <p className="tmB-modal-hint">
              LinkedIn often blocks automated reads. If that happens, we help you paste instead.
            </p>
            {linkErr && <p className="tmB-build-err">{linkErr}</p>}
            <div className="tmB-modal-actions">
              <button
                type="button"
                className="tm-btn tm-btn--outline"
                onClick={() => setShowLinkModal(false)}
                disabled={linkBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tm-btn tm-btn--primary"
                onClick={importFromLink}
                disabled={linkBusy}
              >
                {linkBusy ? "Reading…" : "Import my resume"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
