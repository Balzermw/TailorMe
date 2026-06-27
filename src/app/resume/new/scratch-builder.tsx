"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, Plus, Trash2 } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";
import { composeContact } from "@/lib/apply/contact";
import { loadSavedResume, setResumeDraft, type SavedResume } from "@/lib/resume";
import { ROUTES } from "@/components/landing/data";

type Exp = { id: number; role: string; company: string; dates: string; bullets: string };
type Edu = { id: number; degree: string; school: string; dates: string };

// Guided minimum setup, then hand off to the full editor. Collects just enough
// to assemble a normalized TailoredDoc; the user refines everything in the
// shared editor afterwards.
export default function ScratchBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [headline, setHeadline] = useState("");
  const [exp, setExp] = useState<Exp[]>([{ id: 0, role: "", company: "", dates: "", bullets: "" }]);
  const [edu, setEdu] = useState<Edu[]>([]);
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [existingResume, setExistingResume] = useState<SavedResume | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  // Stable ids (so adding/removing animates only the changed row, not the rest)
  // and a "removing" set that plays the exit animation before the row is dropped.
  const idRef = useRef(1);
  const nextId = () => idRef.current++;
  const [removing, setRemoving] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let active = true;
    loadSavedResume().then((saved) => {
      if (active) setExistingResume(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const setExpAt = (i: number, p: Partial<Exp>) =>
    setExp((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setEduAt = (i: number, p: Partial<Edu>) =>
    setEdu((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const beginRemove = (id: number) => setRemoving((s) => new Set(s).add(id));
  // Called when the exit animation finishes — actually drop the row now.
  const finishRemove = (id: number) => {
    setExp((xs) => xs.filter((x) => x.id !== id));
    setEdu((xs) => xs.filter((x) => x.id !== id));
    setRemoving((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  function existingResumeLabel() {
    return (
      existingResume?.doc?.headline ||
      existingResume?.doc?.name ||
      existingResume?.name ||
      "Saved source profile"
    );
  }

  function savedAtLabel() {
    if (!existingResume?.savedAt) {
      return "Last saved time is not available for this older source profile.";
    }
    const saved = new Date(existingResume.savedAt);
    if (Number.isNaN(saved.getTime())) {
      return "Last saved time is not available for this older source profile.";
    }
    return `Last saved ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(saved)}.`;
  }

  const existingSourceEditHref = existingResume?.doc ? ROUTES.resumeEdit : ROUTES.resumeImport;
  const existingSourceEditLabel = existingResume?.doc ? "Edit source" : "Update source";

  function create(replaceConfirmed = false) {
    const doc: TailoredDoc = {
      name: name.trim(),
      headline: headline.trim(),
      contact: composeContact({ phone, email, location, linkedin }),
      summary: "",
      experience: exp
        .map((e) => ({
          role: e.role.trim(),
          company: e.company.trim(),
          dates: e.dates.trim(),
          bullets: e.bullets
            .split("\n")
            .map((b) => b.replace(/^[-•\s]+/, "").trim())
            .filter(Boolean),
        }))
        .filter((e) => e.role || e.company || e.bullets.length > 0),
      education: edu
        .map((e) => ({ degree: e.degree.trim(), school: e.school.trim(), dates: e.dates.trim() }))
        .filter((e) => e.degree || e.school),
      skills: skills
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      coverLetter: "",
    };
    if (!doc.name) {
      setErr("Add your name so we can build the resume.");
      return;
    }
    if (!doc.headline && doc.experience.length === 0) {
      setErr("Add a target role or your most recent job to get started.");
      return;
    }
    if (existingResume && !replaceConfirmed) {
      setErr(null);
      setShowReplaceConfirm(true);
      return;
    }
    setErr(null);
    setBusy(true);
    setResumeDraft(doc, undefined, { persistOnLoad: true }); // explicit replacement or first saved resume
    router.push(ROUTES.resumeEdit);
  }

  return (
    <div className="tmB-build">
      <Link href={ROUTES.audit} className="tmB-build-back">
        <ArrowLeft size={15} /> Back
      </Link>
      <header className="tmB-build-head">
        <h1>Let’s build your resume</h1>
        <p>
          Add the basics below; you don’t need everything. Once it’s started, you’ll
          refine every section in the editor and can get feedback.
        </p>
      </header>

      {existingResume && (
        <div className="tmB-replace-card" role="status">
          <CircleAlert className="tmB-replace-icon" size={16} aria-hidden="true" />
          <div className="tmB-replace-copy">
            <b>You already have a source profile</b>
            <p>
              {existingResumeLabel()} &middot; building a new one replaces it
              after you confirm.
            </p>
          </div>
          <Link className="tmB-replace-link" href={existingSourceEditHref}>
            {existingSourceEditLabel}
          </Link>
        </div>
      )}

      {/* You */}
      <section className="tmB-build-sec">
        <h2 className="tmE-panel-title">About you</h2>
        <div className="tmE-field">
          <label>Full name</label>
          <input className="tmE-input" value={name} placeholder="Jordan Rivera" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="tmB-grid2">
          <div className="tmE-field" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input className="tmE-input" type="email" value={email} placeholder="you@email.com" onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="tmE-field" style={{ marginBottom: 0 }}>
            <label>Phone</label>
            <input className="tmE-input" value={phone} placeholder="612-227-1149" onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="tmE-field" style={{ marginBottom: 0 }}>
            <label>City / State</label>
            <input className="tmE-input" value={location} placeholder="Portland, OR" onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="tmE-field" style={{ marginBottom: 0 }}>
            <label>LinkedIn URL</label>
            <input className="tmE-input" type="url" value={linkedin} placeholder="linkedin.com/in/you" onChange={(e) => setLinkedin(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Target */}
      <section className="tmB-build-sec">
        <h2 className="tmE-panel-title">What role are you aiming for?</h2>
        <div className="tmE-field">
          <label>Target role or headline</label>
          <input className="tmE-input" value={headline} placeholder="Customer Support Specialist" onChange={(e) => setHeadline(e.target.value)} />
          <p className="tmE-hint">No resume yet? This is the kind of job you want, and we’ll shape the rest around it.</p>
        </div>
      </section>

      {/* Experience */}
      <section className="tmB-build-sec">
        <h2 className="tmE-panel-title">Experience</h2>
        <p className="tmE-hint" style={{ marginTop: 0 }}>
          Start with your most recent role. One result per line. Lead with what you did and any numbers.
        </p>
        {exp.map((e, i) => (
          <div
            key={e.id}
            className={"tmE-edu tmB-item" + (removing.has(e.id) ? " is-removing" : "")}
            onAnimationEnd={(ev) => {
              if (ev.animationName === "tmB-item-out") finishRemove(e.id);
            }}
          >
            <div className="tmB-grid2">
              <div className="tmE-field" style={{ marginBottom: 0 }}>
                <label>Role</label>
                <input className="tmE-input" value={e.role} placeholder="Support Specialist" onChange={(ev) => setExpAt(i, { role: ev.target.value })} />
              </div>
              <div className="tmE-field" style={{ marginBottom: 0 }}>
                <label>Company</label>
                <input className="tmE-input" value={e.company} placeholder="Acme Inc." onChange={(ev) => setExpAt(i, { company: ev.target.value })} />
              </div>
            </div>
            <div className="tmE-field" style={{ marginTop: 12 }}>
              <label>Dates</label>
              <input className="tmE-input" value={e.dates} placeholder="Jan 2022 – Present" onChange={(ev) => setExpAt(i, { dates: ev.target.value })} />
            </div>
            <div className="tmE-field" style={{ marginBottom: 0 }}>
              <label>What you did (one per line)</label>
              <textarea
                className="tmE-textarea"
                value={e.bullets}
                placeholder={"Resolved 40+ tickets/day with a 95% CSAT\nBuilt help-center docs that cut repeat questions"}
                onChange={(ev) => setExpAt(i, { bullets: ev.target.value })}
              />
            </div>
            {exp.length > 1 && !removing.has(e.id) && (
              <button type="button" className="tmE-edu-remove" onClick={() => beginRemove(e.id)}>
                <Trash2 size={13} /> Remove role
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="tmE-add"
          onClick={() => setExp((xs) => [...xs, { id: nextId(), role: "", company: "", dates: "", bullets: "" }])}
        >
          <Plus size={14} /> Add another role
        </button>
      </section>

      {/* Education */}
      <section className="tmB-build-sec">
        <h2 className="tmE-panel-title">Education <span className="tmB-build-opt">optional</span></h2>
        {edu.map((e, i) => (
          <div
            key={e.id}
            className={"tmE-edu tmB-item" + (removing.has(e.id) ? " is-removing" : "")}
            onAnimationEnd={(ev) => {
              if (ev.animationName === "tmB-item-out") finishRemove(e.id);
            }}
          >
            <div className="tmE-field">
              <label>Degree</label>
              <input className="tmE-input" value={e.degree} placeholder="BSc Computer Science" onChange={(ev) => setEduAt(i, { degree: ev.target.value })} />
            </div>
            <div className="tmB-grid2">
              <div className="tmE-field" style={{ marginBottom: 0 }}>
                <label>School</label>
                <input className="tmE-input" value={e.school} placeholder="State University" onChange={(ev) => setEduAt(i, { school: ev.target.value })} />
              </div>
              <div className="tmE-field" style={{ marginBottom: 0 }}>
                <label>Dates</label>
                <input className="tmE-input" value={e.dates} placeholder="2016 – 2020" onChange={(ev) => setEduAt(i, { dates: ev.target.value })} />
              </div>
            </div>
            {!removing.has(e.id) && (
              <button type="button" className="tmE-edu-remove" onClick={() => beginRemove(e.id)}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="tmE-add"
          onClick={() => setEdu((xs) => [...xs, { id: nextId(), degree: "", school: "", dates: "" }])}
        >
          <Plus size={14} /> Add education
        </button>
      </section>

      {/* Skills */}
      <section className="tmB-build-sec">
        <h2 className="tmE-panel-title">Skills <span className="tmB-build-opt">optional</span></h2>
        <div className="tmE-field">
          <label>Skills (one per line, or comma-separated)</label>
          <textarea
            className="tmE-textarea"
            value={skills}
            placeholder={"Customer support\nZendesk\nSLA management"}
            onChange={(e) => setSkills(e.target.value)}
          />
        </div>
      </section>

      {err && <p className="tmB-build-err">{err}</p>}
      {showReplaceConfirm && existingResume ? (
        <div className="tmB-replace-confirm" role="alert">
          <b>Replace your saved source profile?</b>
          <p>
            This makes the new resume your active source profile. Targeted
            applications you already created stay in your dashboard.
          </p>
          <p className="tmB-replace-meta">
            Current: {existingResumeLabel()}. {savedAtLabel()}
          </p>
          <div>
            <button
              type="button"
              className="tm-btn tm-btn--outline"
              onClick={() => setShowReplaceConfirm(false)}
              disabled={busy}
            >
              Keep current
            </button>
            <button
              type="button"
              className="tm-btn tm-btn--primary"
              onClick={() => create(true)}
              disabled={busy}
            >
              {busy ? "Creating..." : "Replace and continue"}
            </button>
          </div>
        </div>
      ) : (
        <div className="tmB-build-actions">
          <button type="button" className="tm-btn tm-btn--primary" onClick={() => create()} disabled={busy}>
            {busy ? "Creating..." : "Create my resume"} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
