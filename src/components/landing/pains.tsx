import { PAINS } from "./data";

function VizTasklist() {
  return (
    <div className="tmB-pviz" aria-hidden="true">
      {[68, 62, 70, 64].map((w, i) => (
        <div key={i} className="tmB-pviz-row">
          <span className="tmB-pviz-dot"></span>
          <span className="tmB-pviz-bar" style={{ width: `${w}%` }}></span>
        </div>
      ))}
    </div>
  );
}

function VizSilence() {
  return (
    <div className="tmB-pviz tmB-pviz--row" aria-hidden="true">
      {[1, 0.7, 0.45, 0.25].map((o, i) => (
        <span key={i} className="tmB-pviz-app" style={{ opacity: o }}></span>
      ))}
      <span className="tm-pill tm-pill--gray">0 replies</span>
    </div>
  );
}

function VizBuried() {
  return (
    <div className="tmB-pviz" aria-hidden="true">
      <div className="tmB-pviz-row">
        <span className="tmB-pviz-bar" style={{ width: "84%" }}></span>
      </div>
      <div className="tmB-pviz-row">
        <span className="tmB-pviz-bar" style={{ width: "72%" }}></span>
      </div>
      <div className="tmB-pviz-row">
        <span
          className="tmB-pviz-bar tmB-pviz-bar--value"
          style={{ width: "34%" }}
        ></span>
        <span className="tmB-pviz-note">your real impact</span>
      </div>
      <div className="tmB-pviz-row">
        <span className="tmB-pviz-bar" style={{ width: "78%" }}></span>
      </div>
    </div>
  );
}

const VIZ = [VizTasklist, VizSilence, VizBuried];

export default function Pains() {
  return (
    <section className="tm-sec tm-tint--gray">
      <div className="tm-wrap">
        <h2 className="tm-h2">The resume is the bottleneck</h2>
        <p className="tm-body mt-[10px] max-w-[66ch]">
          What we hear from senior candidates — and what it costs them in
          response rates.
        </p>
        <div className="tmB-strip mt-[24px]">
          {PAINS.map((p, i) => {
            const Viz = VIZ[i];
            return (
              <div key={p.q} className="tm-card tmB-quote">
                <Viz />
                <q>{p.q}</q>
                <p>{p.d}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
