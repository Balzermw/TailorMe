import { ImageResponse } from "next/og";

export const alt = "TailorMe by Res.Me";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Flat brand OG image — white surface, ink/blue/zinc, no gradients or shadows.
// next/og supports a flexbox subset; any element with multiple children sets display:flex.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
        }}
      >
        {/* Wordmark — top-left */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: "#18181b" }}>
            TailorMe
          </span>
          <span style={{ fontSize: 26, fontWeight: 400, color: "#71717a" }}>
            · by Res.Me
          </span>
        </div>

        {/* Headline — "stronger" in brand blue */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: "#18181b",
            maxWidth: 1000,
          }}
        >
          <span style={{ display: "flex" }}>Your experience is</span>
          <span style={{ display: "flex", color: "#4373db", marginLeft: 18 }}>
            stronger
          </span>
          <span style={{ display: "flex", marginLeft: 18 }}>
            than your resume makes it look.
          </span>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 400,
            color: "#71717a",
            letterSpacing: "0.01em",
          }}
        >
          Tailored resumes · specialist AI review · optional human expert
        </div>
      </div>
    ),
    { ...size }
  );
}
