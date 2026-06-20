import { Check, ClipboardList, FileText } from "lucide-react";

export default function HowItWorks() {
  return (
    <section className="tm-sec tm-tint--blue">
      <div className="tm-wrap">
        <h2 className="tm-h2">How it works</h2>
        <p className="tm-body mt-[10px] max-w-[64ch]">
          Three steps from raw resume to a tailored application. The first one
          is free.
        </p>
        <div className="tmB-tl mt-[10px]">
          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">1</span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">Upload your resume once</h3>
              <p className="tmB-tl-sub">
                We extract skills, experience, and the achievements buried in
                your bullets, with no reformatting needed.
              </p>
              <div className="tm-card tmB-tl-card">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      background: "var(--tm-blue-50)",
                      color: "var(--tm-blue-800)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    AM
                  </span>
                  <div>
                    <p
                      style={{
                        fontWeight: 500,
                        fontSize: "13.5px",
                        marginBottom: "2px",
                      }}
                    >
                      Alex Mercer
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--tm-zinc)" }}>
                      Senior Platform Engineer · Copenhagen
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <span className="tm-pill">7 years exp.</span>
                  <span className="tm-pill">18 bullets parsed</span>
                  <span className="tm-pill">Node.js · Kubernetes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">2</span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">Paste the job you want</h3>
              <p className="tmB-tl-sub">
                A URL or the raw posting text. Fit is scored across five
                dimensions before you spend a credit.
              </p>
              <div className="tm-card tmB-tl-card tmB-tl-job">
                <ClipboardList size={17} />
                <span>
                  <b>Senior Platform Engineer</b> · Nordpeak Systems
                </span>
                <span className="tm-pill tm-pill--mint ml-auto">
                  84 · strong fit
                </span>
              </div>
            </div>
          </div>

          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">
              <Check size={14} />
            </span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">Download resume + feedback</h3>
              <p className="tmB-tl-sub">
                A tailored, compiled two-page PDF and cover letter, plus
                line-level fixes from three specialist reviewers.
              </p>
              <div className="tm-card tmB-tl-card tmB-tl-out">
                <span className="tmB-ev-file">
                  <FileText size={15} /> Resume_Nordpeak.pdf{" "}
                  <span className="ok">
                    <Check size={11} /> 2 pages
                  </span>
                </span>
                <span className="tmB-ev-file">
                  <FileText size={15} /> Cover_Nordpeak.pdf{" "}
                  <span className="ok">
                    <Check size={11} /> 1 page
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
