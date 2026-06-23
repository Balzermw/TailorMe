import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

export interface ResumeFixture {
  id: string;
  category: string;
  path: string;
  sourceText: string;
  expected: {
    candidateName: string;
    roleTitles: string[];
    employers: string[];
    skills: string[];
    education?: string;
  };
}

const fixtureRoot = path.join(process.cwd(), "tests", "e2e", "fixtures", "resumes");
const generatedRoot = path.join(fixtureRoot, "generated");

const sourceFixtures = [
  {
    id: "support-ats",
    category: "ats-plain",
    fileName: "qa-synthetic-support-ats.txt",
    candidateName: "Jordan Rivera",
    roleTitles: ["Customer Support Specialist"],
    employers: ["Northstar Tools"],
    skills: ["Zendesk", "SLA management", "SQL"],
    education: "State University",
    text: [
      "Jordan Rivera",
      "Customer Support Specialist",
      "jordan.synthetic@example.com | 555-010-1000 | Portland, OR",
      "",
      "Summary",
      "Customer support specialist with experience resolving technical tickets, writing help-center articles, and improving SLA performance.",
      "",
      "Experience",
      "Customer Support Specialist, Northstar Tools, Jan 2022 - Present",
      "- Resolved 45+ tickets per day across email and chat while maintaining 96% CSAT.",
      "- Built 18 help-center articles that reduced repeat questions by 22%.",
      "- Partnered with operations to improve escalations and first-response time.",
      "",
      "Education",
      "BA Communications, State University, 2020",
      "",
      "Skills",
      "Zendesk, SLA management, SQL, customer onboarding, documentation",
    ].join("\n"),
  },
  {
    id: "engineer-long",
    category: "long",
    fileName: "qa-synthetic-engineer-long.txt",
    candidateName: "Morgan Lee",
    roleTitles: ["Platform Engineer", "Software Engineer"],
    employers: ["Aster Cloud", "Brightstack"],
    skills: ["Kubernetes", "Node.js", "Datadog"],
    education: "Metro Tech",
    text: [
      "Morgan Lee",
      "Platform Engineer",
      "morgan.synthetic@example.com | 555-010-1100 | Denver, CO",
      "",
      "Summary",
      "Platform engineer focused on distributed services, reliability, observability, and developer tooling.",
      "",
      "Experience",
      "Platform Engineer, Aster Cloud, Mar 2021 - Present",
      "- Led Kubernetes deployment standards across 16 services and reduced rollback time by 35%.",
      "- Built Datadog dashboards and SLO reporting used by 9 engineering teams.",
      "- Migrated Node.js services to a shared platform handling 2.4M daily requests.",
      "Software Engineer, Brightstack, Jun 2018 - Feb 2021",
      "- Improved API latency by 38% through caching and query tuning.",
      "- Mentored 4 junior engineers through code reviews and release planning.",
      "",
      "Projects",
      "Deployment Insights: built an internal release dashboard for service owners.",
      "",
      "Education",
      "BS Computer Science, Metro Tech, 2018",
      "",
      "Skills",
      "Kubernetes, Node.js, TypeScript, AWS, Datadog, Terraform, PostgreSQL, CI/CD",
    ].join("\n"),
  },
  {
    id: "career-switcher-short",
    category: "short",
    fileName: "qa-synthetic-career-switcher-short.txt",
    candidateName: "Casey Martin",
    roleTitles: ["Operations Coordinator"],
    employers: ["Harbor Health"],
    skills: ["Excel", "vendor coordination", "scheduling"],
    text: [
      "Casey Martin",
      "Operations Coordinator",
      "casey.synthetic@example.com | 555-010-1200",
      "",
      "Experience",
      "Operations Coordinator, Harbor Health, 2020 - Present",
      "- Coordinated weekly schedules for 42 staff members.",
      "- Reconciled vendor invoices and reduced processing delays.",
      "",
      "Skills",
      "Excel, vendor coordination, scheduling, customer service",
    ].join("\n"),
  },
  {
    id: "table-heavy",
    category: "table-heavy",
    fileName: "qa-synthetic-table-heavy.md",
    candidateName: "Riley Chen",
    roleTitles: ["Data Analyst"],
    employers: ["Civic Metrics"],
    skills: ["Python", "Tableau", "SQL"],
    education: "Lakeside College",
    text: [
      "# Riley Chen",
      "Data Analyst | riley.synthetic@example.com | 555-010-1300",
      "",
      "| Company | Role | Dates | Impact |",
      "| --- | --- | --- | --- |",
      "| Civic Metrics | Data Analyst | 2021-Present | Built Tableau dashboards for 7 departments |",
      "| Civic Metrics | Reporting Associate | 2019-2021 | Automated weekly SQL reports |",
      "",
      "Education: BS Statistics, Lakeside College, 2019",
      "Skills: Python, SQL, Tableau, data validation, stakeholder reporting",
    ].join("\n"),
  },
  {
    id: "formatted-icons",
    category: "icon-heavy",
    fileName: "qa-synthetic-formatted-icons.txt",
    candidateName: "Taylor Smith",
    roleTitles: ["Marketing Manager"],
    employers: ["Copper Finch"],
    skills: ["HubSpot", "SEO", "campaign analytics"],
    education: "Westline University",
    text: [
      "Taylor Smith",
      "Marketing Manager",
      "Email: taylor.synthetic@example.com | Phone: 555-010-1400 | LinkedIn: linkedin.com/in/taylor-synthetic",
      "",
      "Profile",
      "Marketing manager with content, SEO, and lifecycle campaign experience.",
      "",
      "Experience",
      "Marketing Manager - Copper Finch - 2021 to Present",
      "- Increased organic traffic 41% through SEO refreshes and editorial planning.",
      "- Managed HubSpot nurture campaigns across 5 audience segments.",
      "- Built campaign reporting that cut weekly analysis time by 6 hours.",
      "",
      "Education",
      "BA Marketing, Westline University, 2018",
      "",
      "Skills",
      "HubSpot, SEO, campaign analytics, lifecycle marketing, copywriting",
    ].join("\n"),
  },
] as const;

export async function ensureSyntheticResumeFixtures(): Promise<ResumeFixture[]> {
  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.mkdir(generatedRoot, { recursive: true });

  const fixtures: ResumeFixture[] = [];
  for (const item of sourceFixtures) {
    const target = path.join(fixtureRoot, item.fileName);
    await fs.writeFile(target, item.text, "utf8");
    fixtures.push(toFixture(target, item));
  }

  const docxSource = sourceFixtures[1];
  const docxPath = path.join(generatedRoot, "qa-synthetic-engineer.docx");
  await fs.writeFile(docxPath, await buildDocx(docxSource.text));
  fixtures.push(toFixture(docxPath, { ...docxSource, id: "engineer-docx", category: "docx" }));

  const pdfSource = sourceFixtures[0];
  const pdfPath = path.join(generatedRoot, "qa-synthetic-support.pdf");
  await fs.writeFile(pdfPath, buildPdf(pdfSource.text));
  fixtures.push(toFixture(pdfPath, { ...pdfSource, id: "support-pdf", category: "pdf" }));

  return fixtures;
}

function toFixture(
  filePath: string,
  item: {
    id: string;
    category: string;
    text: string;
    candidateName: string;
    roleTitles: readonly string[];
    employers: readonly string[];
    skills: readonly string[];
    education?: string;
  },
): ResumeFixture {
  return {
    id: item.id,
    category: item.category,
    path: filePath,
    sourceText: item.text,
    expected: {
      candidateName: item.candidateName,
      roleTitles: [...item.roleTitles],
      employers: [...item.employers],
      skills: [...item.skills],
      education: item.education,
    },
  };
}

async function buildDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const paragraphs = text
    .split(/\r?\n/)
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line || " ")}</w:t></w:r></w:p>`,
    )
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}<w:sectPr/></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function buildPdf(text: string): Buffer {
  const lines = text.split(/\r?\n/).slice(0, 42);
  const body = [
    "BT",
    "/F1 10 Tf",
    "50 760 Td",
    "14 TL",
    ...lines.map((line) => `(${escapePdf(line)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
