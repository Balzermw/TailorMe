// Synthetic (no PII) resume + target pairs that are INTENTIONALLY poor fits.
// Used to verify the fit analysis stays honest — it must NOT call these strong
// fits, must NOT invent missing skills/experience, and should surface a manual-
// review nudge. The `expectAtMost` tier is the live-eval ceiling, not a unit
// assertion (model output isn't deterministic); run scripts/eval against these.

export interface FitCase {
  name: string;
  resume: string;
  target: string;
  expectAtMost: "Good" | "Moderate" | "Weak" | "Poor";
}

export const POOR_FIT_CASES: FitCase[] = [
  {
    name: "Barista → Senior Software Engineer",
    target:
      "Senior Software Engineer — distributed backend systems. Requirements: 6+ years building production services in Go or Java, deep experience with Kubernetes, microservices, and cloud (AWS/GCP), strong CS fundamentals, and a track record of owning large-scale systems.",
    resume: [
      "JAMIE RIVERA — Barista & Shift Lead",
      "Cedar & Co. Coffee, Portland OR — 2021–Present",
      "- Prepared espresso drinks and managed the morning rush for a busy cafe.",
      "- Trained 5 new baristas on drink recipes and POS procedures.",
      "- Handled cash, opening/closing, and daily inventory counts.",
      "Sunrise Diner — Server, 2019–2021",
      "- Delivered friendly table service and resolved customer issues.",
      "SKILLS: Customer service, POS systems, teamwork, time management",
      "EDUCATION: High school diploma, 2019",
    ].join("\n"),
    expectAtMost: "Poor",
  },
  {
    name: "Junior graphic designer → Senior Data Scientist",
    target:
      "Senior Data Scientist. Requirements: MS/PhD in a quantitative field, 5+ years applied ML, strong Python, statistics, and experience deploying models (PyTorch/TensorFlow, SQL, A/B testing) at scale.",
    resume: [
      "ALEX KIM — Graphic Designer",
      "Freelance, 2022–Present",
      "- Designed logos, social media graphics, and brand kits for small businesses.",
      "- Built marketing one-pagers and event posters in Adobe Illustrator and Figma.",
      "BrightLeaf Studio — Junior Designer, 2021–2022",
      "- Produced web banners and edited photos for client campaigns.",
      "SKILLS: Photoshop, Illustrator, Figma, typography, branding",
      "EDUCATION: BFA, Graphic Design, 2021",
    ].join("\n"),
    expectAtMost: "Poor",
  },
  {
    name: "Junior marketing coordinator → VP of Engineering",
    target:
      "VP of Engineering. Requirements: 12+ years in software engineering, 5+ years leading engineering orgs (50+ engineers), deep technical architecture experience, and a record of scaling platforms and hiring senior leaders.",
    resume: [
      "TAYLOR MORGAN — Marketing Coordinator",
      "Lumen Retail Group, 2022–Present",
      "- Scheduled social posts and coordinated email newsletters.",
      "- Helped organize two trade-show booths and tracked campaign metrics in a spreadsheet.",
      "- Supported the marketing manager with vendor scheduling.",
      "SKILLS: Social media, Canva, Mailchimp, Google Analytics, event support",
      "EDUCATION: BA Communications, 2022",
    ].join("\n"),
    expectAtMost: "Poor",
  },
  {
    name: "Bookkeeper → Senior Product Manager",
    target:
      "Senior Product Manager. Requirements: 6+ years product management, owning roadmap and strategy, leading discovery with engineering/design, defining metrics and running experiments, and driving measurable business outcomes.",
    resume: [
      "JORDAN BLAKE — Bookkeeper / Accounting Clerk",
      "Maple Accounting Services, 2018–Present",
      "- Reconciled accounts, processed AP/AR, and prepared monthly financial statements.",
      "- Managed payroll for 30 employees and filed quarterly tax documents.",
      "- Used QuickBooks and Excel to track expenses and budgets.",
      "SKILLS: QuickBooks, Excel, bookkeeping, payroll, attention to detail",
      "EDUCATION: Associate degree, Accounting, 2018",
    ].join("\n"),
    expectAtMost: "Weak",
  },
  {
    name: "New grad, no experience → Engineering Manager",
    target:
      "Engineering Manager. Requirements: 8+ years software engineering, 3+ years managing engineers, experience with performance reviews, hiring, technical roadmaps, and cross-team delivery.",
    resume: [
      "SAM PATEL — Computer Science Graduate",
      "B.S. Computer Science, State University, 2025",
      "- Coursework: data structures, algorithms, databases, web development.",
      "- Capstone: a class scheduling web app built with React and Node.js (team of 4).",
      "- Teaching assistant for intro programming (one semester).",
      "SKILLS: Java, Python, React, Git, SQL (coursework level)",
    ].join("\n"),
    expectAtMost: "Poor",
  },
];
