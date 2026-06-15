import { describe, expect, it } from "vitest";
import {
  analyze,
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
