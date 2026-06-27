import "server-only";
import type { ResumeStats } from "@/lib/types";

// Resume file parsing: extract plain text from PDF / Word / text uploads, plus
// lightweight heuristics for the "what we extracted" preview. Pure local work —
// no API key needed, so it runs in demo mode too.

const KNOWN_SKILLS = [
  "React", "Node.js", "TypeScript", "JavaScript", "Python", "Go", "Rust",
  "Java", "Kotlin", "Swift", "Kubernetes", "Docker", "AWS", "GCP", "Azure",
  "PostgreSQL", "MySQL", "Redis", "MongoDB", "GraphQL", "REST", "Kafka",
  "Terraform", "CI/CD", "Observability", "Datadog", "Distributed systems",
  "Microservices", "Next.js", "Vue", "Tailwind", "PHP", "Ruby", "Rails",
  "Django", "Spring", "Mentoring", "Leadership", "Agile", "Scrum",
];

const BULLET_RE = /^\s*[-•*●·]\s+/;
const YEAR_RANGE_RE = /\b(19|20)\d{2}\b.*?(present|current|(19|20)\d{2})/i;
// A quantified metric: a percentage, currency, a number with a k/m/b/x suffix,
// a decimal, or any 2+ digit run (38%, $1, 2.4M, 40k, p95).
const METRIC_RE = /\d+\s?%|\$\s?\d|\d+(\.\d+)?\s?[kmbx]\b|\d+\.\d+|\d{2,}/i;
const CONTACT_LINE_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|linkedin\.com\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+|\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b|\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/i;

/** A single positioned text run from a PDF page (PDF origin is bottom-left). */
export interface PdfTextItem {
  str: string;
  x: number; // left edge of the run
  y: number; // baseline — larger y = higher on the page
  w: number; // run width
  h: number; // approx glyph height
}

/**
 * Reconstruct human reading order for ONE page from positioned text runs.
 *
 * PDF.js returns runs in document/stream order, which interleaves multi-column
 * resumes (a sidebar + main column produce alternating left/right runs at the
 * same y, so flat extraction reads "Skills Experience React Led migration…").
 * We detect a vertical gutter that almost no run crosses; if found, we emit the
 * whole left column top-to-bottom, then the right. Otherwise we fall back to a
 * plain top→bottom, left→right pass (correct for single-column resumes).
 *
 * Pure and deterministic so it can be unit-tested without a real PDF.
 */
export function reconstructReadingOrder(
  items: PdfTextItem[],
  pageWidth: number,
): string {
  const clean = items.filter((i) => i.str.trim().length > 0);
  if (clean.length === 0) return "";

  const heights = clean
    .map((i) => i.h)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const medianH = heights.length ? heights[Math.floor(heights.length / 2)] : 10;
  const yTol = Math.max(3, medianH * 0.6);

  const gutter = detectGutter(clean, pageWidth);
  const columns =
    gutter == null
      ? [clean]
      : [
          clean.filter((i) => i.x + i.w / 2 < gutter),
          clean.filter((i) => i.x + i.w / 2 >= gutter),
        ];

  return columns
    .map((col) => columnToText(col, yTol))
    .filter((t) => t.length > 0)
    .join("\n");
}

/** Find a vertical gutter (x) that cleanly separates two columns, else null. */
function detectGutter(items: PdfTextItem[], pageWidth: number): number | null {
  if (items.length < 12 || pageWidth <= 0) return null;
  const candidates = [0.42, 0.46, 0.5, 0.54, 0.58].map((f) => f * pageWidth);
  let best: { x: number; straddle: number } | null = null;
  for (const g of candidates) {
    let straddle = 0;
    let left = 0;
    let right = 0;
    for (const it of items) {
      const l = it.x;
      const r = it.x + it.w;
      if (l < g && r > g) straddle++;
      else if (r <= g) left++;
      else right++;
    }
    if (left >= 4 && right >= 4 && (best == null || straddle < best.straddle)) {
      best = { x: g, straddle };
    }
  }
  if (best == null) return null;
  // Only trust a gutter that almost no run crosses (≤3% of runs, or ≤2).
  const limit = Math.max(2, Math.floor(items.length * 0.03));
  return best.straddle <= limit ? best.x : null;
}

/** Order one column's runs into lines (top→bottom), runs left→right with spacing. */
/**
 * Collapse the letter-spacing inside a single PDF run. A run whose text is
 * entirely single letters separated by single spaces ("M O N I R", "S O F T W A R E")
 * is letter-spacing, not real words — word breaks are encoded between runs, never
 * inside one — so removing the inner spaces is safe.
 */
function despaceRun(str: string): string {
  return /^[A-Za-z](?: [A-Za-z])+$/.test(str.trim())
    ? str.replace(/ /g, "")
    : str;
}

function columnToText(items: PdfTextItem[], yTol: number): string {
  if (items.length === 0) return "";
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfTextItem[][] = [];
  let cur: PdfTextItem[] = [];
  let anchorY = sorted[0].y;
  for (const it of sorted) {
    if (cur.length === 0 || Math.abs(it.y - anchorY) <= yTol) {
      cur.push(it);
      anchorY = (anchorY * (cur.length - 1) + it.y) / cur.length;
    } else {
      lines.push(cur);
      cur = [it];
      anchorY = it.y;
    }
  }
  if (cur.length) lines.push(cur);

  return lines
    .map((line) => {
      const runs = [...line].sort((a, b) => a.x - b.x);
      let s = "";
      let prevRight: number | null = null;
      for (const it of runs) {
        if (prevRight != null && it.x - prevRight > Math.max(1.5, it.h * 0.25)) {
          s += " ";
        }
        // Letter-spaced headers (a styled name, "P R O F E S S I O N A L") arrive
        // as runs whose own text is single letters joined by spaces ("M O N I R");
        // word breaks live BETWEEN runs (a standalone space run or an x-gap), so
        // collapsing the spacing inside one run never merges two words.
        s += despaceRun(it.str);
        prevRight = it.x + it.w;
      }
      return s.replace(/[ \t]+/g, " ").trim();
    })
    .filter((l) => l.length > 0)
    .join("\n");
}

/** True when extraction came back essentially empty — a scanned/image-only PDF. */
export function looksScanned(text: string): boolean {
  return text.replace(/\s+/g, "").length < 100;
}

/**
 * Collapse per-character letter-spacing artifacts ("M D M O N I R",
 * "P R O F E S S I O N A L") back into words. Some resume templates letter-space
 * names and section headers, which PDF/Word extraction surfaces as each glyph
 * separated by a space. We only touch lines clearly dominated by single-letter
 * tokens (never normal prose), and keep word boundaries that survive as wider
 * gaps (2+ spaces, preserved by docx body extraction) — so a spaced
 * "J E S S I C A   H E D S T R O M" becomes "JESSICA HEDSTROM".
 */
export function collapseLetterSpacing(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      const singles = words.filter((w) => /^[A-Za-z]$/.test(w)).length;
      // Require a real run of spaced single letters so we never collapse a lone
      // "A"/"I" or an "A B" pair in ordinary text.
      if (singles < 4 || singles < words.length * 0.7) return line;
      // Split on the wider gaps (word breaks), de-space each chunk's letters,
      // then rejoin: "J E S S I C A   H E D S T R O M" -> "JESSICA HEDSTROM".
      return line
        .split(/ {2,}/)
        .map((chunk) => chunk.replace(/(?<=\b[A-Za-z]) (?=[A-Za-z]\b)/g, ""))
        .join(" ");
    })
    .join("\n");
}

/**
 * Extract text from a PDF in human reading order (multi-column aware), using
 * the raw PDF.js text-item positions unpdf already exposes — no extra deps.
 * Falls back to unpdf's flat page-merge if reconstruction throws or yields
 * nothing (e.g. a malformed document), so we never regress to a hard failure.
 */
async function extractPdfTextOrdered(bytes: ArrayBuffer): Promise<string> {
  const { getDocumentProxy, extractText: extractFlat } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageWidth = page.getViewport({ scale: 1 }).width;
      const items: PdfTextItem[] = [];
      for (const raw of content.items as Array<{
        str?: unknown;
        transform?: unknown;
        width?: unknown;
        height?: unknown;
      }>) {
        if (typeof raw.str !== "string" || raw.str.length === 0) continue;
        const tr = raw.transform;
        if (!Array.isArray(tr) || tr.length < 6) continue;
        const x = Number(tr[4]);
        const y = Number(tr[5]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const w = typeof raw.width === "number" ? raw.width : 0;
        const h =
          typeof raw.height === "number" && raw.height > 0
            ? raw.height
            : Math.abs(Number(tr[3])) || 10;
        items.push({ str: raw.str, x, y, w, h });
      }
      const text = reconstructReadingOrder(items, pageWidth);
      if (text) pages.push(text);
    }
    const joined = pages.join("\n\n").trim();
    if (joined) return joined;
  } catch {
    /* fall through to flat extraction */
  }
  const { text } = await extractFlat(pdf, { mergePages: true });
  return text;
}

/**
 * Drop DOCX header/footer/textbox chunks already present in the body, then join
 * the survivors. Comparison removes ALL whitespace and lowercases, so a
 * letter-spaced header name ("J E S S I C A   H E D S T R O M") is recognized
 * against the clean body line ("Jessica Hedstrom") instead of being prepended
 * and later uniform-collapsed into a duplicate ("JESSICAHEDSTROM").
 */
export function dedupeHeaderExtra(chunks: string[], body: string): string {
  const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const seen = squash(body);
  return chunks
    .filter((c) => squash(c).length > 1 && !seen.includes(squash(c).slice(0, 24)))
    .join("\n");
}

/** Extract plain text from an uploaded resume by file type. */
export async function extractText(
  filename: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return collapseLetterSpacing(await extractPdfTextOrdered(bytes));
  }
  if (lower.endsWith(".docx")) {
    const buf = Buffer.from(bytes);
    const mammoth = (await import("mammoth")).default;
    const { value: body } = await mammoth.extractRawText({ buffer: buf });
    // extractRawText reads the document body only — name/contact blocks placed
    // in a header, footer, or text box (common in modern templates) are lost.
    // Pull those parts straight from the docx zip so the parser still sees them.
    let extra = "";
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buf);
      const strip = (xml: string) =>
        xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const chunks: string[] = [];
      for (const name of Object.keys(zip.files)) {
        if (/^word\/(header|footer)\d*\.xml$/i.test(name)) {
          chunks.push(strip(await zip.files[name].async("string")));
        }
      }
      const docFile = zip.files["word/document.xml"];
      const docXml = docFile ? await docFile.async("string") : "";
      for (const m of docXml.matchAll(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/g)) {
        chunks.push(strip(m[1]));
      }
      // Prepend only the parts the body doesn't already contain, so the parser
      // sees the name/contact up top where it expects them.
      extra = dedupeHeaderExtra(chunks, body);
    } catch {
      /* zip read unavailable → fall back to body-only (no regression) */
    }
    return collapseLetterSpacing(extra ? `${extra}\n\n${body}` : body);
  }
  if (lower.endsWith(".doc")) {
    // Legacy Word (OLE/.doc) — mammoth only reads .docx, so use word-extractor.
    const WordExtractor = (await import("word-extractor")).default;
    const doc = await new WordExtractor().extract(Buffer.from(bytes));
    return collapseLetterSpacing(doc.getBody());
  }
  // .txt / .md / unknown → decode as UTF-8
  return collapseLetterSpacing(new TextDecoder().decode(bytes));
}

// Shared with the client UI; lives in its own (non-server-only) module so the
// audit/editor surfaces can import it too. Re-exported here for server callers.
export { isPlaceholderName } from "./placeholder-name";

/** Heuristic stats from resume text — real, derived from the actual content. */
export function analyze(text: string): ResumeStats {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const publicLines = lines.filter((l) => !CONTACT_LINE_RE.test(l));

  // Name: first short line that looks like a person's name (no digits, ≤4 words).
  const name =
    publicLines.find(
      (l) =>
        !/\d/.test(l) &&
        l.split(/\s+/).length <= 4 &&
        /^[A-Za-z]/.test(l),
    ) ?? "Your resume";

  const bulletLines = publicLines.filter((l) => BULLET_RE.test(l));
  const evidenceLines = (bulletLines.length ? bulletLines : publicLines.filter((l) => l.length > 40))
    .map(stripBulletMarker)
    .filter((l) => l.length >= 30);
  const bullets = bulletLines.length || publicLines.filter((l) => l.length > 40).length;
  const metricBullets = (bulletLines.length ? bulletLines : publicLines).filter((l) =>
    METRIC_RE.test(l),
  ).length;
  const roles = lines.filter((l) => YEAR_RANGE_RE.test(l)).length;

  const haystack = text.toLowerCase();
  const skills = KNOWN_SKILLS.filter((s) =>
    haystack.includes(s.toLowerCase()),
  );
  const proofPoints = fallbackProofPoints(evidenceLines, metricBullets);

  return {
    name,
    roles: Math.max(roles, 1),
    bullets: Math.max(bullets, 1),
    metricBullets,
    skills,
    sampleBullets: evidenceLines.slice(0, 6).map((line) => ({
      text: clip(line, 180),
      hasMetric: METRIC_RE.test(line),
    })),
    proofPoints,
    weaknesses: proofPoints.map((p) => p.title),
  };
}

function stripBulletMarker(line: string): string {
  return line.replace(BULLET_RE, "").trim();
}

function clip(line: string, max: number): string {
  return line.length <= max ? line : `${line.slice(0, max - 1).trim()}...`;
}

function fallbackProofPoints(
  evidenceLines: string[],
  metricBullets: number,
): NonNullable<ResumeStats["proofPoints"]> {
  const points: NonNullable<ResumeStats["proofPoints"]> = [];
  const unquantified = evidenceLines.find((line) => !METRIC_RE.test(line));
  if (unquantified) {
    points.push({
      title: "Add measurable impact",
      summary: "This experience line states work without showing the result.",
      quote: clip(unquantified, 160),
      why:
        "Recruiters and ATS screens can see the activity, but they cannot tell scope, volume, speed, quality, or business impact from this line alone.",
      fix:
        "Add a truthful metric such as volume handled, time saved, error reduction, revenue, cost, users, tickets, SLA, team size, budget, latency, uptime, or throughput.",
      severity: metricBullets === 0 ? "high" : "medium",
    });
  }
  if (metricBullets === 0) {
    points.push({
      title: "No quantified wins found",
      summary: "The readable resume text does not show a clear metric-backed accomplishment.",
      why:
        "A resume with only responsibilities is harder to rank against candidates who show measurable outcomes.",
      fix:
        "For each major role, add one honest result number where the source supports it. Use ranges only when they are true.",
      severity: "high",
    });
  }
  return points.slice(0, 3);
}
