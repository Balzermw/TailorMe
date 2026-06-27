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
  // Work-authorization / citizenship tokens ("U.S. Citizen", "Authorized to
  // work", "H-1B") parsed off a pipe-separated contact line. Kept OUT of the
  // city/state `location` field but preserved as their own trailing segment on
  // recompose, so the header keeps the info without polluting city/state.
  extra?: string;
  // The order the fields appeared in the source string, so editing one field
  // doesn't reshuffle the others on recompose (e.g. a phone listed last stays
  // last). Absent -> canonical order. Carried through edits inside the object.
  order?: ContactKey[];
};

const CANONICAL: ContactKey[] = ["phone", "email", "location", "linkedin"];
const CONTACT_SPLIT_RE = /\s*[|\u00b7]\s*/;
// Work-authorization / citizenship phrases that resumes list among contact
// segments. These are not a city/state, so we peel them out of `location`.
const WORK_AUTH_RE =
  /\b(?:u\.?\s?s\.?\s?)?citizen(?:ship)?\b|authorized to work|work authoriz(?:ation|ed)|work permit|green ?card|permanent resident|lawful permanent|\bvisa\b|\bh-?1b\b|\bead\b|\bopt\b|\bcpt\b|\btn visa\b|right to work|naturalized/i;
const LINKEDIN_URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin|linkedgin)\.com\/[^\s"'<>|,;]+/gi;
const LINKEDIN_LABEL_RE = /\b(?:linkedin|linkedgin)\b\s*[:\-]?/gi;

function addOrder(order: ContactKey[], key: ContactKey) {
  if (!order.includes(key)) order.push(key);
}

function cleanLooseSeparators(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*([,;|])\s*/g, "$1 ")
    .replace(/(?:[,;|]\s*){2,}/g, ", ")
    .replace(/^[\s,;|:()[\].-]+|[\s,;|:()[\].-]+$/g, "")
    .replace(/\s+,/g, ",")
    .trim();
}

function normalizePhone(value: string): string {
  const raw = (value || "").trim();
  const digits = raw.replace(/\D/g, "");
  const hasCountryOne = /^\s*(?:\+1|1[\s().-])/.test(raw);
  const local = digits.length === 11 && digits.startsWith("1") && hasCountryOne
    ? digits.slice(1)
    : digits;
  if (local.length !== 10) return cleanLooseSeparators(raw);
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

function extractLinkedin(value: string): { text: string; linkedin: string } {
  const links: string[] = [];
  const text = cleanLooseSeparators(
    (value || "")
      .replace(LINKEDIN_URL_RE, (match) => {
        const clean = match.replace(/[.)\]]+$/g, "");
        links.push(clean);
        return match.slice(clean.length);
      })
      .replace(LINKEDIN_LABEL_RE, ""),
  );
  return { text, linkedin: links[0] ?? "" };
}

function normalizeOrder(order: ContactKey[] | undefined): ContactKey[] | undefined {
  if (!order?.length) return undefined;
  const seen = new Set<ContactKey>();
  const normalized: ContactKey[] = [];
  for (const key of order) {
    if (CANONICAL.includes(key) && !seen.has(key)) {
      seen.add(key);
      normalized.push(key);
    }
  }
  return normalized.length ? normalized : undefined;
}

export function normalizeContactFields(fields: ContactFields): ContactFields {
  const next: ContactFields = {
    phone: normalizePhone(fields.phone || ""),
    email: (fields.email || "").trim(),
    location: (fields.location || "").trim(),
    linkedin: (fields.linkedin || "").trim(),
    extra: (fields.extra || "").trim() || undefined,
    order: normalizeOrder(fields.order),
  };

  const fromLocation = extractLinkedin(next.location);
  if (fromLocation.linkedin) {
    next.location = fromLocation.text;
    if (!next.linkedin) next.linkedin = fromLocation.linkedin;
  } else {
    next.location = cleanLooseSeparators(next.location);
  }

  const fromLinkedin = extractLinkedin(next.linkedin);
  if (fromLinkedin.linkedin) {
    if (!next.location && fromLinkedin.text && !/@/.test(fromLinkedin.text)) {
      next.location = fromLinkedin.text;
    }
    next.linkedin = fromLinkedin.linkedin;
  } else {
    next.linkedin = cleanLooseSeparators(
      next.linkedin.replace(LINKEDIN_LABEL_RE, ""),
    );
  }

  if ((fromLocation.linkedin || fromLinkedin.linkedin) && next.linkedin && next.order?.length) {
    const order = normalizeOrder(next.order) ?? [];
    if (next.location) addOrder(order, "location");
    addOrder(order, "linkedin");
    next.order = order.length ? order : undefined;
  }

  return next;
}

export function parseContact(contact: string): ContactFields {
  const parts = (contact || "")
    .split(CONTACT_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  const f: ContactFields = { phone: "", email: "", location: "", linkedin: "" };
  const order: ContactKey[] = [];
  const rest: string[] = [];
  const auth: string[] = [];
  let locationSeen = false;

  for (const raw of parts) {
    const extracted = extractLinkedin(raw);
    const p = extracted.text;
    if (!p && /^linkedin$/i.test(raw)) continue;

    const digits = (p.match(/\d/g) || []).length;
    if (!f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p)) {
      f.email = p;
      addOrder(order, "email");
    } else if (!f.linkedin && /(?:linkedin|linkedgin)\.com/i.test(p)) {
      f.linkedin = p;
      addOrder(order, "linkedin");
    } else if (/^linkedin$/i.test(p)) {
      continue; // bare "LinkedIn" placeholder, drop
    } else if (!f.phone && digits >= 7 && !/@/.test(p)) {
      f.phone = p;
      addOrder(order, "phone");
    } else if (WORK_AUTH_RE.test(p)) {
      auth.push(p); // citizenship / work-authorization — keep out of city/state
    } else if (p) {
      rest.push(p);
      if (!locationSeen) {
        addOrder(order, "location");
        locationSeen = true;
      }
    }

    if (extracted.linkedin && !f.linkedin) {
      f.linkedin = extracted.linkedin;
      addOrder(order, "linkedin");
    }
  }

  f.location = rest.join(", ");
  f.extra = auth.join(", ") || undefined;
  f.order = order;
  return normalizeContactFields(f);
}

export function composeContact(f: ContactFields): string {
  const normalized = normalizeContactFields(f);
  // Emit in the source order when known, appending any newly-filled fields in
  // canonical order at the end, so editing a field never reshuffles the rest.
  const seq =
    normalized.order && normalized.order.length
      ? [
          ...normalized.order,
          ...CANONICAL.filter((k) => !normalized.order!.includes(k)),
        ]
      : CANONICAL;
  const parts = seq.map((k) => (normalized[k] || "").trim()).filter(Boolean);
  // Work-authorization / citizenship segment trails the standard fields so it
  // survives the round-trip without ever landing in the city/state field.
  if (normalized.extra) parts.push(normalized.extra.trim());
  return parts.join(" | ");
}

export function normalizeContactLine(contact: string): string {
  return composeContact(parseContact(contact));
}
