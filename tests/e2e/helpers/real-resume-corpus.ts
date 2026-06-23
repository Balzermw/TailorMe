import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { redactText } from "./redact";

export interface RealResumeItem {
  id: string;
  filePath: string;
  type: string;
  sizeBytes: number;
  category: string;
}

export interface RealResumeResult {
  id: string;
  type: string;
  category: string;
  status: "passed" | "failed" | "skipped";
  stage: string;
  error?: string;
  qualityScore?: number;
  qualityIssues?: string[];
  qualitySignals?: {
    agentCount: number;
    actionableMentions: number;
    charCount: number;
    sensitiveLeaks: string[];
    targetKeywordMentions?: number;
    gapMentions?: number;
    groundingMentions?: number;
    metricGuidanceMentions?: number;
    sectionMentions?: number;
    rewritePairCount?: number;
    concreteFixCount?: number;
    genericPhraseCount?: number;
    uniqueTokenRatio?: number;
    maxSimilarityToPrior?: number;
  };
}

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".txt", ".md"]);

export async function loadRealResumeCorpus(): Promise<RealResumeItem[]> {
  if (process.env.RUN_REAL_RESUME_CORPUS !== "1") return [];
  const root = process.env.REAL_RESUME_CORPUS_DIR;
  if (!root) throw new Error("REAL_RESUME_CORPUS_DIR is required when RUN_REAL_RESUME_CORPUS=1.");
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new Error("REAL_RESUME_CORPUS_DIR must point to a local directory.");

  const allFiles = await walk(root);
  const filterType = (process.env.REAL_RESUME_FILTER_TYPE || "").toLowerCase().replace(/^\./, "");
  const filterCategory = (process.env.REAL_RESUME_FILTER_CATEGORY || "").toLowerCase();
  const start = Math.max(0, Number(process.env.REAL_RESUME_BATCH_START || 0) || 0);
  const limit = Math.max(1, Number(process.env.REAL_RESUME_BATCH_LIMIT || 50) || 50);

  const items: RealResumeItem[] = [];
  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;
    const type = ext.slice(1);
    const category = categorizeFile(filePath);
    if (filterType && type !== filterType) continue;
    if (filterCategory && category !== filterCategory) continue;
    const info = await fs.stat(filePath);
    items.push({
      id: anonymizedId(filePath),
      filePath,
      type,
      category,
      sizeBytes: info.size,
    });
  }

  items.sort((a, b) => a.id.localeCompare(b.id));
  return items.slice(start, start + limit);
}

export async function writeRealResumeReport(results: RealResumeResult[]): Promise<void> {
  const docsDir = path.join(process.cwd(), "docs", "qa");
  const resultsDir = path.join(process.cwd(), "tests", "e2e", "results");
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const minQualityScore = process.env.REAL_RESUME_MIN_QUALITY_SCORE || "85";
  const lines = [
    "# Real Resume Corpus Results",
    "",
    "Private corpus reports are anonymized. Raw filenames, resume text, parsed JSON, and screenshots are intentionally omitted.",
    "",
    `- Total: ${results.length}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    `- Skipped: ${skipped}`,
    `- Min quality score: ${minQualityScore}`,
    "",
    "| ID | Type | Category | Status | Stage | Quality | Issues | Error |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.type} | ${r.category} | ${r.status} | ${r.stage} | ${r.qualityScore ?? ""} | ${sanitizeCell((r.qualityIssues ?? []).join(", "))} | ${sanitizeCell(r.error ?? "")} |`,
    ),
    "",
  ].join("\n");
  const suffix = safeSuffix(process.env.REAL_RESUME_REPORT_SUFFIX || "");
  const markdownName = suffix
    ? `REAL_RESUME_CORPUS_RESULTS_${suffix}.md`
    : "REAL_RESUME_CORPUS_RESULTS.md";
  const jsonName = suffix
    ? `real-resume-corpus-results-${suffix}.json`
    : "real-resume-corpus-results.json";
  await fs.writeFile(path.join(docsDir, markdownName), lines, "utf8");
  await fs.writeFile(
    path.join(resultsDir, jsonName),
    JSON.stringify(results, null, 2),
    "utf8",
  );
}

function anonymizedId(filePath: string): string {
  return `rr-${crypto.createHash("sha256").update(path.resolve(filePath)).digest("hex").slice(0, 12)}`;
}

function categorizeFile(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (/multi|column/.test(lower)) return "multi-column";
  if (/table/.test(lower)) return "table-heavy";
  if (/scan|image/.test(lower)) return "image-heavy";
  if (/long/.test(lower)) return "long";
  if (/short/.test(lower)) return "short";
  return "uncategorized";
}

async function walk(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sanitizeCell(value: string): string {
  return redactText(value, { realResume: true })
    .replace(/\|/g, "/")
    .replace(/\r?\n/g, " ")
    .slice(0, 220);
}

function safeSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
