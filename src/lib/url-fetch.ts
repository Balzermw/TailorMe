// Guarded server-side fetch of a user-supplied URL, used by the "import from a
// link" flow (LinkedIn / personal site / portfolio). Fetching an arbitrary URL
// the user typed is an SSRF surface, so every hop is validated against private
// address ranges before we connect. Node runtime only (uses node:dns/node:net).

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const MAX_FETCH_BYTES = 2_000_000; // cap the response body (~2 MB)
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;

/** True for loopback / private / link-local / reserved IPs (v4 + v6). */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const o = ip.split(".").map(Number);
    if (o.length !== 4 || o.some((n) => Number.isNaN(n))) return true;
    if (o[0] === 10 || o[0] === 127 || o[0] === 0) return true; // private / loopback / "this host"
    if (o[0] === 192 && o[1] === 168) return true; // private
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // private
    if (o[0] === 169 && o[1] === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // carrier-grade NAT
    if (o[0] >= 224) return true; // multicast / reserved
    return false;
  }
  const ip6 = ip.toLowerCase();
  if (ip6 === "::1" || ip6 === "::") return true; // loopback / unspecified
  if (ip6.startsWith("::ffff:")) return isPrivateIp(ip6.slice(7)); // v4-mapped
  if (ip6.startsWith("fc") || ip6.startsWith("fd")) return true; // unique-local fc00::/7
  if (/^fe[89ab]/.test(ip6)) return true; // link-local fe80::/10
  return false;
}

/** Hostnames we never resolve/fetch (internal names + literal private IPs). */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (isIP(h) && isPrivateIp(h)) return true;
  return false;
}

/** Strip HTML to readable, line-broken plain text (no DOM, regex only). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function hostIsPublic(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) return false;
  if (isIP(hostname)) return !isPrivateIp(hostname); // literal IP already checked above
  try {
    const records = await lookup(hostname, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

export type FetchUrlResult =
  | { ok: true; text: string; finalHost: string }
  | { ok: false; reason: "invalid" | "blocked" | "fetch" };

/**
 * Fetch a URL's readable text with SSRF protection: only http(s), no credentials
 * in the URL, every hop (incl. redirects) resolved and checked against private
 * address ranges, a timeout, and a body-size cap. Returns the extracted text or
 * a reason it couldn't (the caller decides how to fall back).
 */
export async function fetchUrlText(rawUrl: string): Promise<FetchUrlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "invalid" };
  if (url.username || url.password) return { ok: false, reason: "blocked" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Follow redirects manually so each destination is re-validated (a public URL
    // can 30x to a private one; that's the classic SSRF redirect bypass).
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await hostIsPublic(url.hostname))) return { ok: false, reason: "blocked" };
      const res = await fetch(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; TailorMeBot/1.0; +https://tailorme.app/bot)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, reason: "fetch" };
        url = new URL(location, url); // resolve relative redirects; re-checked next loop
        if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "blocked" };
        continue;
      }
      if (!res.ok) return { ok: false, reason: "fetch" };
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype && !/text\/html|application\/xhtml|text\/plain/i.test(ctype)) {
        return { ok: false, reason: "fetch" };
      }
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > MAX_FETCH_BYTES ? buf.slice(0, MAX_FETCH_BYTES) : buf;
      const text = htmlToText(new TextDecoder("utf-8").decode(slice));
      return { ok: true, text, finalHost: url.hostname };
    }
    return { ok: false, reason: "fetch" }; // too many redirects
  } catch {
    return { ok: false, reason: "fetch" };
  } finally {
    clearTimeout(timer);
  }
}
