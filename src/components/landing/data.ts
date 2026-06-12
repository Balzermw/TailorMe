// Copy and data for the TailorMe homepage — ported verbatim from the
// "ApplyForMeWebDesignv2" design handoff (TailorMe Homepage Final, Direction B).

export const HEADLINE = {
  pre: "Your experience is ",
  em: "stronger",
  post: " than your resume makes it look.",
};

export const PAINS = [
  {
    q: "My strong work reads like a task list.",
    d: "Seven years of real impact, written like a job description.",
  },
  {
    q: "I apply everywhere and hear nothing.",
    d: "The same resume goes to forty postings — and silence comes back from most of them.",
  },
  {
    q: "Recruiters don’t see my value.",
    d: "They skim for the role they’re filling. A generic resume makes them do the translation — they won’t.",
  },
];

export const PLAN = [
  {
    icon: "upload",
    t: "Upload your resume once",
    d: "We build a structured profile from it — skills, experience, the achievements buried in your bullets.",
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
    name: "ATS & keywords",
    note: "Posting names observability 3× — your resume names it 0×. Add your Datadog dashboard work.",
  },
  {
    name: "Impact & metrics",
    note: "“Mentored junior engineers” — how many, over how long? Add team scope.",
  },
  {
    name: "Role-fit",
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
    a: "No. Keywords only get added where your experience actually supports them — the real work is re-positioning: re-ranking your bullets for the role, translating tasks into impact, and cutting what isn’t pulling weight.",
  },
  {
    q: "Will this get me interviews?",
    a: "We don’t promise interviews or jobs — nobody honestly can. What we promise is a resume that’s interview-ready: tailored to the posting, aligned with how ATS systems parse it, and reviewed line by line.",
  },
  {
    q: "How is this different from a template or a chatbot?",
    a: "Templates change how your resume looks; chatbots rewrite in one generic pass. TailorMe rewrites for one specific posting, runs three specialist reviewers over the draft, and compiles an inspected two-page PDF — with the reasoning shown.",
  },
  {
    q: "What happens to my resume data?",
    a: "It’s encrypted at rest, never used to train models, and you can delete everything with one click. GDPR-aligned by design.",
  },
  {
    q: "What does the human review add?",
    a: "A professional Res.Me writer goes through your final draft line by line and adds positioning notes for your target role, within 48 hours. It’s optional — every application already includes the full agent review. +$49 per application.",
  },
  {
    q: "Do credits expire?",
    a: "Never. Buy a pack, use it across your whole search — this month or next year. No subscription, no API keys.",
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

// Route map for CTAs and nav — pages beyond the homepage ship incrementally.
export const ROUTES = {
  home: "/",
  audit: "/audit",
  transformation: "/transformation",
  pricing: "/pricing",
  coaching: "/coaching",
  signIn: "/signin",
  buyCredits: "/buy-credits",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
};
