// The resume stores contact as one pipe-joined string (print-doc linkifies
// emails and real URLs in it). The editor and the scratch builder split it into
// fields for editing, then recompose. Parse is best-effort; the user can correct
// any field. Shared so both surfaces emit the identical format (no drift).

export type ContactKey = "phone" | "email" | "location" | "linkedin";

export type ContactFields = {
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  // The order the fields appeared in the source string, so editing one field
  // doesn't reshuffle the others on recompose (e.g. a phone listed last stays
  // last). Absent → canonical order. Carried through edits inside the object.
  order?: ContactKey[];
};

const CANONICAL: ContactKey[] = ["phone", "email", "location", "linkedin"];

export function parseContact(contact: string): ContactFields {
  const parts = (contact || "")
    .split(/\s*[|·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const f: ContactFields = { phone: "", email: "", location: "", linkedin: "" };
  const order: ContactKey[] = [];
  const rest: string[] = [];
  let locationSeen = false;
  for (const p of parts) {
    const digits = (p.match(/\d/g) || []).length;
    if (!f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p)) {
      f.email = p;
      order.push("email");
    } else if (!f.linkedin && /linkedin\.com/i.test(p)) {
      f.linkedin = p;
      order.push("linkedin");
    } else if (/^linkedin$/i.test(p)) {
      continue; // bare "LinkedIn" placeholder, drop
    } else if (!f.phone && digits >= 7 && !/@/.test(p)) {
      f.phone = p;
      order.push("phone");
    } else {
      rest.push(p);
      if (!locationSeen) {
        order.push("location");
        locationSeen = true;
      }
    }
  }
  f.location = rest.join(", ");
  f.order = order;
  return f;
}

export function composeContact(f: ContactFields): string {
  // Emit in the source order when known, appending any newly-filled fields in
  // canonical order at the end — so editing a field never reshuffles the rest.
  const seq =
    f.order && f.order.length
      ? [...f.order, ...CANONICAL.filter((k) => !f.order!.includes(k))]
      : CANONICAL;
  return seq
    .map((k) => (f[k] || "").trim())
    .filter(Boolean)
    .join(" | ");
}
