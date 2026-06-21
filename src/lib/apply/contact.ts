// The resume stores contact as one pipe-joined string (print-doc linkifies
// emails and real URLs in it). The editor and the scratch builder split it into
// fields for editing, then recompose. Parse is best-effort; the user can correct
// any field. Shared so both surfaces emit the identical format (no drift).

export type ContactFields = {
  phone: string;
  email: string;
  location: string;
  linkedin: string;
};

export function parseContact(contact: string): ContactFields {
  const parts = (contact || "")
    .split(/\s*[|·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const f: ContactFields = { phone: "", email: "", location: "", linkedin: "" };
  const rest: string[] = [];
  for (const p of parts) {
    const digits = (p.match(/\d/g) || []).length;
    if (!f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p)) f.email = p;
    else if (!f.linkedin && /linkedin\.com/i.test(p)) f.linkedin = p;
    else if (/^linkedin$/i.test(p)) continue; // bare "LinkedIn" placeholder, drop
    else if (!f.phone && digits >= 7 && !/@/.test(p)) f.phone = p;
    else rest.push(p);
  }
  f.location = rest.join(", ");
  return f;
}

export function composeContact(f: ContactFields): string {
  return [f.phone, f.email, f.location, f.linkedin]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ");
}
