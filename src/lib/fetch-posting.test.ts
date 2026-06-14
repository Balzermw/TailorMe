import { describe, expect, it } from "vitest";
import { extractPostingText, isPrivateIp } from "./fetch-posting";

describe("SSRF address guard", () => {
  it("blocks loopback / private / link-local / reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.5.5", "172.31.255.255",
      "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1",
      "255.255.255.255", "192.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4 (incl. just-outside-range)", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("blocks loopback / ULA / link-local IPv6 and IPv4-mapped private (incl. hex/NAT64/compat forms)", () => {
    for (const ip of [
      "::1", "::", "fe80::1", "fc00::1", "fd12::3456",
      "::ffff:127.0.0.1", "::ffff:10.0.0.1", // dotted IPv4-mapped
      "::ffff:7f00:1", "::ffff:a9fe:a9fe",    // hex IPv4-mapped (127.0.0.1 / 169.254.169.254)
      "64:ff9b::a9fe:a9fe",                    // NAT64 → 169.254.169.254
      "::a9fe:a9fe",                            // IPv4-compatible → 169.254.169.254
      "2002:7f00:1::1", "2002:a9fe:a9fe::1",  // 6to4 → 127.0.0.1 / 169.254.169.254
      "fec0::1",                                // site-local (deprecated)
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("treats malformed input as unsafe", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("999.1.1.1")).toBe(true);
    expect(isPrivateIp("")).toBe(true);
  });
});

describe("HTML posting extraction", () => {
  it("strips scripts/styles/nav/footer, keeps body text, decodes entities", () => {
    const html =
      `<html><head><title>Job</title><style>.x{color:red}</style></head>` +
      `<body><nav>menu links</nav>` +
      `<h1>Senior Engineer</h1>` +
      `<p>Build &amp; ship things. 5+ years &lt;required&gt;.</p>` +
      `<ul><li>Node.js</li><li>Kubernetes</li></ul>` +
      `<footer>footer junk</footer><script>evil()</script></body></html>`;
    const text = extractPostingText(html);
    expect(text).toContain("Senior Engineer");
    expect(text).toContain("Build & ship things");
    expect(text).toContain("5+ years <required>");
    expect(text).toContain("Node.js");
    expect(text).toContain("Kubernetes");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("menu links");
    expect(text).not.toContain("footer junk");
    expect(text).not.toContain("color:red");
  });

  it("prefers a substantial <main> region over the surrounding chrome", () => {
    const filler = "Posting detail sentence. ".repeat(20); // > 200 chars
    const html =
      `<body><nav>SITE NAVIGATION</nav><main><p>${filler}</p></main>` +
      `<aside>UNRELATED SIDEBAR</aside></body>`;
    const text = extractPostingText(html);
    expect(text).toContain("Posting detail sentence");
    expect(text).not.toContain("UNRELATED SIDEBAR");
  });
});
