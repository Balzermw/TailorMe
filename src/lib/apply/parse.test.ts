import { describe, expect, it } from "vitest";
import {
  analyze,
  collapseLetterSpacing,
  dedupeHeaderExtra,
  isPlaceholderName,
  looksScanned,
  reconstructReadingOrder,
  type PdfTextItem,
} from "./parse";
import { SAMPLE_RESUME } from "./sample";

describe("resume analysis heuristics", () => {
  it("extracts the name, roles, bullets, metrics, and skills from the sample", () => {
    const s = analyze(SAMPLE_RESUME);
    expect(s.name).toBe("Alex Mercer");
    expect(s.roles).toBeGreaterThanOrEqual(2); // two dated roles
    expect(s.bullets).toBeGreaterThan(3);
    expect(s.metricBullets).toBeGreaterThan(0); // "2.4M", "40k", "38%"
    expect(s.skills).toEqual(
      expect.arrayContaining(["React", "Node.js", "Kubernetes"]),
    );
  });

  it("degrades gracefully on sparse text", () => {
    const s = analyze("Jane Doe\nsome unstructured prose without any tech words");
    expect(s.name).toBe("Jane Doe"); // first ≤4-word, digit-free line
    expect(s.roles).toBeGreaterThanOrEqual(1);
    expect(s.bullets).toBeGreaterThanOrEqual(1);
    expect(s.skills).toEqual([]);
  });

  it("does not treat contact lines as the candidate name", () => {
    const s = analyze(
      [
        "alex@example.com",
        "linkedin.com/in/alex",
        "555-222-1212",
        "Jane Doe",
        "Senior Engineer",
        "- Built onboarding workflows for enterprise customers.",
      ].join("\n"),
    );
    const publicText = JSON.stringify(s);
    expect(s.name).toBe("Jane Doe");
    expect(publicText).not.toMatch(/alex@example\.com|linkedin\.com|555-222-1212/i);
    expect(s.proofPoints?.[0]?.quote).toBe("Built onboarding workflows for enterprise customers.");
  });
});

// Build one positioned run. PDF origin is bottom-left, so larger y = higher.
function run(str: string, x: number, y: number, w = 100, h = 11): PdfTextItem {
  return { str, x, y, w, h };
}

describe("multi-column reading-order reconstruction", () => {
  it("emits the full left column before the right (does not interleave)", () => {
    // A sidebar+main resume: left runs at x≈50, right runs at x≈350, sharing the
    // same rows. PDF.js stream order would alternate L,R,L,R… at each y.
    const ys = [700, 680, 660, 640, 620, 600];
    const items: PdfTextItem[] = [];
    ys.forEach((y, i) => {
      items.push(run(`Left${i + 1}`, 50, y));
      items.push(run(`Right${i + 1}`, 350, y));
    });

    const text = reconstructReadingOrder(items, 600);

    // Every left-column run must precede every right-column run.
    expect(text.indexOf("Left6")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Right1")).toBeGreaterThan(text.indexOf("Left6"));
    // And within a column, reading order is preserved top→bottom.
    expect(text.indexOf("Left1")).toBeLessThan(text.indexOf("Left2"));
    expect(text.indexOf("Right1")).toBeLessThan(text.indexOf("Right6"));
  });

  it("keeps single-column resumes in plain top→bottom order", () => {
    // Wide, full-width lines → no clean gutter → single-column fallback.
    const items: PdfTextItem[] = [];
    for (let i = 1; i <= 12; i++) {
      items.push(run(`Line${i}`, 50, 720 - i * 18, 400));
    }
    const text = reconstructReadingOrder(items, 600);
    expect(text.indexOf("Line1")).toBeLessThan(text.indexOf("Line2"));
    expect(text.indexOf("Line2")).toBeLessThan(text.indexOf("Line12"));
  });

  it("joins runs on the same line with spacing", () => {
    const items = [run("Senior", 50, 700, 60), run("Engineer", 120, 700, 80)];
    const text = reconstructReadingOrder(items, 600);
    expect(text).toBe("Senior Engineer");
  });

  it("returns empty string for no runs", () => {
    expect(reconstructReadingOrder([], 600)).toBe("");
  });

  it("collapses letter-spacing inside runs, keeping between-run word breaks", () => {
    // Real PDF shape: each word is a run whose text is single letters joined by
    // spaces ("M D", "M O N I R"); the word break is a standalone space run.
    const items = [
      run("M D", 222, 700, 45),
      run(" ", 267, 700, 24),
      run("M O N I R", 285, 700, 104),
    ];
    expect(reconstructReadingOrder(items, 600)).toBe("MD MONIR");
  });

  it("splits letter-spaced words separated by an x-gap (no space run)", () => {
    const items = [run("S O F T W A R E", 50, 700, 70), run("E N G I N E E R", 140, 700, 70)];
    expect(reconstructReadingOrder(items, 600)).toBe("SOFTWARE ENGINEER");
  });
});

describe("letter-spacing collapse", () => {
  it("collapses spaced glyphs, preserving word breaks at wider gaps", () => {
    expect(collapseLetterSpacing("J E S S I C A   H E D S T R O M")).toBe(
      "JESSICA HEDSTROM",
    );
    expect(collapseLetterSpacing("P R O F E S S I O N A L   S U M M A R Y")).toBe(
      "PROFESSIONAL SUMMARY",
    );
  });

  it("collapses a uniform-spaced run into a single token (no boundary to keep)", () => {
    expect(collapseLetterSpacing("M D M O N I R")).toBe("MDMONIR");
  });

  it("leaves ordinary prose and short letter pairs untouched", () => {
    const prose = "Led a team of 8 engineers to ship the A B testing platform.";
    expect(collapseLetterSpacing(prose)).toBe(prose);
    expect(collapseLetterSpacing("Built CI/CD with C and Go")).toBe(
      "Built CI/CD with C and Go",
    );
  });
});

describe("scanned-PDF detection", () => {
  it("flags empty / near-empty extraction as scanned", () => {
    expect(looksScanned("")).toBe(true);
    expect(looksScanned("   \n\t  \n ")).toBe(true);
    expect(looksScanned("Page 1")).toBe(true); // a stray header only
  });

  it("does not flag a real resume", () => {
    expect(looksScanned(SAMPLE_RESUME)).toBe(false);
  });
});

describe("placeholder-name detection", () => {
  it("flags unfilled template placeholders (case / bracket / spacing insensitive)", () => {
    for (const p of [
      "CANDIDATE NAME",
      "Candidate Name",
      "  candidate   name ",
      "Your Name",
      "Your Full Name",
      "Full Name",
      "[Name]",
      "<Your Name>",
      "First Last",
      "Firstname Lastname",
      "First Middle Last",
      "Name Here",
      "Applicant Name",
      "Lorem Ipsum",
      "Name",
    ]) {
      expect(isPlaceholderName(p)).toBe(true);
    }
  });

  it("never flags a real name (no false positives that would scold a real person)", () => {
    for (const real of [
      "Alex Mercer",
      "Jessica Hedstrom",
      "MD Monir",
      "Miguel Lara Chavez",
      "Sarah First", // surname "First" but no literal "name" token
      "Robert Last", // surname "Last" but no literal "name" token
      "Grace Hopper",
      "Jean-Luc Picard",
      "Wei Zhang",
    ]) {
      expect(isPlaceholderName(real)).toBe(false);
    }
  });

  it("returns false for empty / our own 'no name found' fallback", () => {
    expect(isPlaceholderName("")).toBe(false);
    expect(isPlaceholderName("   ")).toBe(false);
    expect(isPlaceholderName("Your resume")).toBe(false); // the analyze() fallback, not a placeholder
  });
});

describe("DOCX header/textbox dedup", () => {
  it("drops a letter-spaced header name already present (clean) in the body", () => {
    // The header surfaces the name with each glyph spaced; the body has it clean.
    const header = "J E S S I C A   H E D S T R O M";
    const body = "Jessica Hedstrom\nSoftware Engineer\n- Built things.";
    expect(dedupeHeaderExtra([header], body)).toBe(""); // recognized as a duplicate
  });

  it("keeps a genuinely new header chunk the body does not contain", () => {
    const header = "Security Clearance: TS/SCI";
    const body = "Jessica Hedstrom\nSoftware Engineer";
    expect(dedupeHeaderExtra([header], body)).toBe(header);
  });

  it("drops a normally-spaced header duplicate too (whitespace-insensitive)", () => {
    const header = "Jessica   Hedstrom"; // extra spaces from XML strip
    const body = "Jessica Hedstrom\nSoftware Engineer";
    expect(dedupeHeaderExtra([header], body)).toBe("");
  });

  it("ignores empty / single-character chunks", () => {
    expect(dedupeHeaderExtra(["", " ", "x"], "anything")).toBe("");
  });
});
