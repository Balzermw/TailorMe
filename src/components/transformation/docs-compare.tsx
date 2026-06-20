import { ArrowRight } from "lucide-react";

function BeforeDoc() {
  return (
    <div className="tmT-page-stack" aria-label="Original resume spans 3 pages">
      <div className="tmT-page-count" aria-hidden="true">
        <span className="tmT-pages-mini">
          <i></i>
          <i></i>
          <i></i>
        </span>
        <b>3 pages</b>
      </div>
      <div className="tm-card tmB-paper tmB-paper--before tmB-paper--page tmT-docmock">
        <div className="tmB-pdoc-head">
          <span className="tmB-pdoc-avatar">AM</span>
          <p className="tmB-pdoc-name">Alex Mercer</p>
          <p className="tmB-pdoc-contact">
            Software Engineer | Copenhagen | alex.m@email.com
          </p>
        </div>
        <div className="tmB-pdoc-rule"></div>
        <p className="tmT-before-summary">
          Results-oriented software engineer and collaborative team player with
          a proven track record of building scalable web applications, solving
          complex problems, and partnering with cross-functional stakeholders in
          fast-paced environments.
        </p>

        <p className="tmB-pdoc-sec">Experience</p>
        <div className="tmB-pdoc-entry">
          <span className="tmB-pdoc-role">
            Senior Software Engineer, Brightline Commerce
          </span>
          <span className="tmB-pdoc-date">2019 - present</span>
        </div>
        <p className="tmT-before-bullet">
          General web application feature work across React, Node.js, and
          internal tools.
        </p>
        <p className="tmT-before-bullet">
          Product, design, and QA coordination for tickets, meetings, and
          handoffs.
        </p>
        <p className="tmT-before-bullet">
          Checkout performance ownership without numbers or baseline context.
        </p>
        <p className="tmT-before-bullet">
          Code reviews, sprint planning, grooming sessions, retrospectives, and
          production support rotations.
        </p>
        <p className="tmT-before-bullet">
          Bug triage, customer issue follow-up, and stakeholder status updates.
        </p>
        <p className="tmT-before-bullet">
          Runbooks, onboarding notes, release checklists, and wiki maintenance.
        </p>

        <div className="tmB-pdoc-entry">
          <span className="tmB-pdoc-role">Software Engineer, Versa Labs</span>
          <span className="tmB-pdoc-date">2014 - 2019</span>
        </div>
        <p className="tmT-before-bullet">
          Customer-facing backend service maintenance and routine database query
          support.
        </p>
        <p className="tmT-before-bullet">
          Internal tooling, deployments, and environment cleanup as needed.
        </p>
        <p className="tmT-before-bullet">
          Business requirement discussions, acceptance criteria, and recurring
          team ceremonies.
        </p>
        <p className="tmT-before-bullet">
          Testing notes, release summaries, standups, and backlog hygiene.
        </p>

        <div className="tmB-pdoc-entry">
          <span className="tmB-pdoc-role">Junior Developer, Webstack Inc.</span>
          <span className="tmB-pdoc-date">2012 - 2014</span>
        </div>
        <p className="tmT-before-bullet">
          Internal tool requests, reported bugs, and day-to-day support for
          senior engineers.
        </p>
        <p className="tmT-before-bullet">
          UI screen updates, form maintenance, and incoming support tickets.
        </p>

        <p className="tmB-pdoc-sec">Projects</p>
        <p className="tmT-before-bullet">
          Engineering dashboards, reports, and recurring metric exports.
        </p>
        <p className="tmT-before-bullet">
          Cloud migration task lists and job-transfer support between systems.
        </p>
        <p className="tmT-before-bullet">
          Team wiki pages, release checklists, and status trackers.
        </p>
        <p className="tmT-before-bullet">
          Production support notes and troubleshooting documentation.
        </p>

        <p className="tmB-pdoc-sec">Skills</p>
        <p className="tmB-pdoc-skills">
          React | Node.js | TypeScript | PostgreSQL | AWS | Docker | Agile |
          Scrum | Jira | Git | REST APIs | Testing | Teamwork | Communication |
          Documentation | Troubleshooting | Customer Support | Production
          Support
        </p>
        <p className="tmT-before-note">
          Missing fit signals: quantified impact, observability language, and
          platform work are buried across three pages of repeated task bullets.
        </p>
        <p className="tmB-pdoc-foot">Original resume sample | page 1 of 3</p>
      </div>
    </div>
  );
}

function AfterDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--doc tmB-paper--page tmB-paper--after tmT-docmock">
      <span className="tmT-doc-tag">Tailored for Nordpeak</span>
      <div className="tmB-pdoc-head">
        <span className="tmB-pdoc-avatar">AM</span>
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">
          Senior Platform Engineer | Copenhagen | alex.m@email.com
        </p>
      </div>
      <div className="tmB-pdoc-rule"></div>
      <p className="tmB-pdoc-summary">
        Platform engineer specializing in distributed Node.js services, checkout
        reliability, and observability-backed releases for high-volume commerce
        systems.
      </p>
      <p className="tmT-summary-remark">
        Targeted summary: specific to Nordpeak&apos;s platform role, not a
        generic team-player headline.
      </p>

      <p className="tmB-pdoc-sec">Experience</p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">
          Senior Software Engineer, Brightline Commerce
        </span>
        <span className="tmB-pdoc-date">2019 - present</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Led migration of checkout to a{" "}
        <mark className="tm-k">distributed Node.js service</mark>, cutting p95
        latency <mark className="tm-m">38%</mark> across{" "}
        <mark className="tm-m">2.4M daily transactions</mark>.
      </p>
      <p className="tmB-pdoc-bullet">
        Mentored <mark className="tm-m">6 engineers</mark> through promotion
        cycles while owning <mark className="tm-k">Kubernetes</mark> deployment
        standards.
      </p>
      <p className="tmB-pdoc-bullet">
        Introduced <mark className="tm-k">Datadog observability</mark>{" "}
        dashboards that reduced incident triage{" "}
        <mark className="tm-m">52%</mark>.
      </p>

      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">Software Engineer, Versa Labs</span>
        <span className="tmB-pdoc-date">2014 - 2019</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Built an order-events pipeline handling{" "}
        <mark className="tm-m">40k messages/min</mark> with{" "}
        <mark className="tm-k">observability</mark> baked into releases.
      </p>
      <p className="tmB-pdoc-bullet">
        Moved legacy batch jobs to AWS workers, improving retry visibility and
        reducing manual reconciliation.
      </p>
      <p className="tmB-pdoc-bullet">
        Cut nightly batch runtime <mark className="tm-m">30%</mark> by
        parallelizing jobs and adding retry-safe checkpoints.
      </p>

      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">Junior Developer, Webstack Inc.</span>
        <span className="tmB-pdoc-date">2012 - 2014</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Built internal UI tools and support workflows for the engineering team.
      </p>

      <p className="tmB-pdoc-sec">Selected Platform Work</p>
      <p className="tmB-pdoc-bullet">
        Owned CI/CD guardrails for checkout releases and coordinated rollback
        playbooks with product operations.
      </p>
      <p className="tmB-pdoc-bullet">
        Partnered with support and data teams to turn customer-impact reports
        into measurable reliability goals.
      </p>

      <p className="tmB-pdoc-sec">Skills</p>
      <p className="tmB-pdoc-skills">
        Distributed systems | Node.js at scale | Kubernetes | PostgreSQL | AWS |
        Docker | CI/CD pipelines | Observability | Mentorship
      </p>

      <p className="tmB-pdoc-sec">Education</p>
      <p className="tmB-pdoc-bullet">
        BSc Computer Science, University of Copenhagen, 2012.
      </p>
    </div>
  );
}

export default function DocsCompare() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2 text-center">The resume, before and after</h2>
        <p className="tmT-subhead text-center">
          The same experience, rewritten and ranked for the role, shown at full
          page size.
        </p>
        <div className="tmT-legend" aria-label="Resume highlight legend">
          <span>
            <i className="tmT-legend-swatch tmT-legend-swatch--keyword"></i>
            Green = ATS and role keywords
          </span>
          <span>
            <i className="tmT-legend-swatch tmT-legend-swatch--metric"></i>
            Blue = quantified proof
          </span>
        </div>
        <div className="tmT-docs mt-[36px]">
          <div className="tmT-doccol">
            <span className="tm-pill tm-pill--gray tmT-doclabel inline-flex">
              Before - 3 pages, generic
            </span>
            <BeforeDoc />
          </div>
          <div className="tmT-docs-arrow">
            <ArrowRight size={22} />
          </div>
          <div className="tmT-doccol">
            <span className="tm-pill tmT-doclabel inline-flex">
              After - 2 pages, tailored to Nordpeak
            </span>
            <AfterDoc />
          </div>
        </div>

      </div>
    </section>
  );
}
