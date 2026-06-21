// Copy and data for the TailorMe homepage — ported verbatim from the
// "ApplyForMeWebDesignv2" design handoff (TailorMe Homepage Final, Direction B).

export const HEADLINE = {
  pre: "Your experience is ",
  em: "stronger",
  post: " than your resume makes it look.",
};

export const PAINS = [
  {
    q: "My best work reads like a task list.",
    d: "Seven years of real impact, written like a job description.",
  },
  {
    q: "I apply everywhere and hear nothing.",
    d: "One resume sent to forty postings, and silence from almost all of them.",
  },
  {
    q: "Recruiters don’t see my value.",
    d: "They skim for the exact role. A generic resume makes them do the translation, so they don’t.",
  },
];

export const PLAN = [
  {
    icon: "upload",
    t: "Upload your resume once",
    d: "We build a structured profile from it: skills, experience, the achievements buried in your bullets.",
  },
  {
    icon: "clipboard-list",
    t: "Paste the job you want",
    d: "A URL or the raw posting text. We score your fit across five dimensions before you spend a credit.",
  },
  {
    icon: "download",
    t: "Download resume + feedback",
    d: "A tailored, compiled two-page PDF and cover letter, plus line-level fixes from three specialist reviewers.",
  },
] as const;

export const AGENT_NOTES = [
  {
    agent: "Ada",
    accent: "var(--tm-blue-600)",
    name: "ATS & keywords",
    note: "Posting names observability 3×; your resume names it 0×. Add your Datadog dashboard work.",
  },
  {
    agent: "Max",
    accent: "#0f7a52",
    name: "Impact & metrics",
    note: "“Mentored junior engineers”: how many, over how long? Add team scope.",
  },
  {
    agent: "Remy",
    accent: "var(--tm-blue-800)",
    name: "Role-Fit",
    note: "This role is 80% backend/platform. Move distributed-systems work above the frontend section.",
  },
];

export const PRICING = [
  { name: "Starter", price: "$19", apps: "5 applications", per: "$3.80 each" },
  {
    name: "Job hunt",
    price: "$49",
    apps: "15 applications",
    per: "$3.27 each",
    popular: true,
  },
  { name: "All in", price: "$99", apps: "40 applications", per: "$2.48 each" },
];

export const FAQS = [
  {
    q: "Is this just keyword stuffing?",
    a: "No. Keywords only get added where your experience actually supports them. The real work is re-positioning: re-ranking your bullets for the role, translating tasks into impact, and cutting what isn’t pulling weight.",
  },
  {
    q: "Will this get me interviews?",
    a: "We don’t promise interviews or jobs; nobody honestly can. What we promise is a resume that’s interview-ready: tailored to the posting, aligned with how ATS systems parse it, and reviewed line by line.",
  },
  {
    q: "How is this different from a template or a chatbot?",
    a: "Templates change how your resume looks; chatbots rewrite in one generic pass. TailorMe rewrites for one specific posting, runs three specialist reviewers over the draft, and compiles an inspected two-page PDF, with the reasoning shown.",
  },
  {
    q: "What happens to my resume data?",
    a: "It’s encrypted at rest, never used to train models, and you can delete everything with one click. GDPR-aligned by design.",
  },
  {
    q: "What does the human review add?",
    a: "A professional Res.Me writer goes through your final draft line by line and adds positioning notes for your target role, within 48 hours. It’s optional: every application already includes the full agent review. +$49 per application.",
  },
  {
    q: "Do credits expire?",
    a: "Never. Buy a pack, use it across your whole search, this month or next year. No subscription, no API keys.",
  },
];

export const TRUST = [
  { icon: "lock", t: "Your resume is encrypted at rest" },
  { icon: "trash-2", t: "Delete everything in one click" },
  { icon: "shield-check", t: "GDPR compliant by design" },
] as const;

export const MICHAEL_CREDS = [
  "Certified Professional Resume Writer",
  "15+ years of experience",
  "650+ resumes written",
  "Fiverr Top Rated Pro · 4.8/5 across 200+ reviews",
];

export const HERO_STAGES = [
  ["Read the job posting", "paste a URL or the posting text"],
  ["Tailor every bullet", "rewritten for this job, not in general"],
  ["Three agents review", "ATS, impact & role-fit fixes applied"],
  ["Build the final PDF", "compiled, then checked page by page"],
];

// Route map for CTAs and nav.
export const ROUTES = {
  home: "/",
  audit: "/audit",
  resumeNew: "/resume/new",
  resumeEdit: "/resume/edit",
  resumePrint: "/resume/print",
  resumeImport: "/resume/import",
  transformation: "/transformation",
  pricing: "/pricing",
  coaching: "/coaching",
  signIn: "/signin",
  forgotPassword: "/forgot-password",
  dashboard: "/dashboard",
  settings: "/settings",
  buyCredits: "/buy-credits",
  bookSession: "/book-session",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
  security: "/security",
};

// Five-dimension fit scoring (sample run — flagship composite persona).
export const SCORES = [
  { l: "Technical skills", v: 88 },
  { l: "Experience match", v: 80 },
  { l: "Culture fit", v: 74 },
  { l: "Career alignment", v: 90 },
];

// Full agent notes (homepage shows only the first note of each).
export const AGENTS_FULL = [
  {
    icon: "search",
    name: "ATS & keywords",
    notes: [
      {
        t: "fix",
        txt: "Posting names observability 3×; your resume names it 0×. Add your Datadog dashboard work.",
      },
      {
        t: "polish",
        txt: "Kubernetes only appears in your skills list. Surface it in an experience bullet.",
      },
    ],
  },
  {
    icon: "trending-up",
    name: "Impact & metrics",
    notes: [
      {
        t: "fix",
        txt: "“Mentored junior engineers”: how many, over how long? Add team scope.",
      },
      {
        t: "polish",
        txt: "The migration bullet needs a baseline: what was p95 latency before?",
      },
    ],
  },
  {
    icon: "target",
    name: "Role-fit",
    notes: [
      {
        t: "fix",
        txt: "This role is 80% backend/platform. Move distributed-systems work above the frontend section.",
      },
      {
        t: "polish",
        txt: "Cut the 2014 PHP role to one line; it isn’t pulling weight for this target.",
      },
    ],
  },
];

// Before/after bullets (flagship transformation, composite).
export const BULLETS = [
  {
    before:
      "“Responsible for developing and maintaining features for the web app using React and Node.js.”",
    after: [
      "“Led migration of checkout to a ",
      { k: "distributed Node.js service" },
      ", cutting p95 latency ",
      { m: "38%" },
      " across ",
      { m: "2.4M daily transactions" },
      ".”",
    ],
  },
  {
    before: "“Participated in code reviews and mentoring.”",
    after: [
      "“Mentored ",
      { m: "6 engineers" },
      " through promotion cycles while owning ",
      { k: "Kubernetes" },
      " deployment standards.”",
    ],
  },
] as const;

export const KEYWORDS = [
  "Distributed systems",
  "Node.js at scale",
  "Kubernetes",
  "Observability",
  "Mentorship",
];
