import { describe, expect, it } from "vitest";
import { htmlToText, isBlockedHostname, isPrivateIp } from "./url-fetch";

describe("isPrivateIp", () => {
  it("flags loopback / private / reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.10",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // carrier-grade NAT
      "0.0.0.0",
      "224.0.0.1", // multicast
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "13.107.42.14"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("handles IPv6 loopback / link-local / unique-local / mapped", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true); // v4-mapped loopback
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks internal names and literal private IPs", () => {
    for (const h of ["localhost", "api.localhost", "db.local", "svc.internal", "127.0.0.1", "10.0.0.1"]) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });

  it("allows normal public hosts", () => {
    for (const h of ["linkedin.com", "www.linkedin.com", "example.com", "8.8.8.8"]) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe("htmlToText", () => {
  it("strips tags and keeps text", () => {
    expect(htmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("drops script/style content", () => {
    expect(htmlToText("<style>.x{color:red}</style><script>bad()</script><p>Hi</p>")).toBe("Hi");
  });

  it("decodes common entities", () => {
    expect(htmlToText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(htmlToText("&lt;tag&gt;")).toBe("<tag>");
  });

  it("turns block boundaries into line breaks", () => {
    expect(htmlToText("<div>Alpha</div><div>Beta</div>")).toBe("Alpha\nBeta");
  });
});
