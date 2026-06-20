import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { MAX_POSTING_CHARS } from "@/lib/limits";

// Server-side job-posting fetcher. Pulls a posting's text from a URL with strong
// SSRF protection: the DNS resolution used for validation is the SAME one used
// for the socket (a guarded `lookup` pins the connection to a validated IP), so
// there is no resolve-then-reconnect window for DNS rebinding. Adds a size cap,
// idle + overall timeouts, bounded redirects (re-validated per hop), and a strict
// content-type gate. Many boards render postings with JavaScript — those won't
// yield text, so callers fall back to "paste the posting" on a PostingFetchError.

const FETCH_IDLE_MS = 8_000; // abort if the socket goes silent (slowloris)
const FETCH_TOTAL_MS = 12_000; // overall deadline incl. body read (slow-drip)
const MAX_BYTES = 2_000_000; // 2 MB of HTML is plenty for a posting page
const MAX_REDIRECTS = 3;
const MIN_USEFUL_CHARS = 200;

/** A user-safe failure (its message is shown to the user). */
export class PostingFetchError extends Error {}

// ---------- SSRF: block private / reserved address space ----------

function isPrivateV4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && o[2] === 0) return true; // 192.0.0.0/24
  if (a >= 224) return true; // multicast (224/4) + reserved (240/4) + broadcast
  return false;
}

/** Expand any IPv6 textual form (incl. embedded dotted-quad) to 8 hextets. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().trim();
  // Convert a trailing embedded IPv4 (e.g. ::ffff:127.0.0.1) to two hextets.
  const dotted = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const o = [dotted[2], dotted[3], dotted[4], dotted[5]].map(Number);
    if (o.some((n) => n > 255)) return null;
    s =
      dotted[1] +
      ((o[0] << 8) | o[1]).toString(16) +
      ":" +
      ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;
  let parts: string[];
  if (tail === null) {
    parts = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    parts = [...head, ...Array(missing).fill("0"), ...tail];
  }
  if (parts.length !== 8) return null;
  const nums = parts.map((h) => (h === "" ? 0 : parseInt(h, 16)));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

function isPrivateV6(ip: string): boolean {
  const h = expandV6(ip);
  if (!h) return true; // unparseable → unsafe
  if (h.every((x) => x === 0)) return true; // :: unspecified
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1 loopback
  if (h[0] >= 0xfe80 && h[0] <= 0xfebf) return true; // fe80::/10 link-local
  if (h[0] >= 0xfec0 && h[0] <= 0xfeff) return true; // fec0::/10 site-local (deprecated)
  if (h[0] >= 0xfc00 && h[0] <= 0xfdff) return true; // fc00::/7 unique-local
  const embeddedV4 = (hi: number, lo: number) =>
    `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  const zeroHead = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;
  if (zeroHead && h[5] === 0xffff) return isPrivateV4(embeddedV4(h[6], h[7])); // ::ffff:0:0/96 IPv4-mapped
  if (h[0] === 0x64 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
    return isPrivateV4(embeddedV4(h[6], h[7])); // 64:ff9b::/96 NAT64
  }
  if (zeroHead && h[5] === 0 && (h[6] !== 0 || h[7] !== 0)) {
    return isPrivateV4(embeddedV4(h[6], h[7])); // ::/96 IPv4-compatible (deprecated)
  }
  if (h[0] === 0x2002) return isPrivateV4(embeddedV4(h[1], h[2])); // 2002::/16 6to4
  return false;
}

/** True if an IP literal is loopback / private / link-local / reserved. */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true; // not a valid IP → unsafe
}

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

/** Validate protocol + host string; reject obviously-internal hosts early. */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PostingFetchError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PostingFetchError("Only http and https links are supported.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !host ||
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new PostingFetchError("That address isn't allowed.");
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new PostingFetchError("That address isn't allowed.");
    return url;
  }
  // Pre-resolve for an early, clean error. The authoritative check is the
  // guarded lookup below, which pins the socket to a validated IP.
  let addrs: { address: string }[];
  try {
    addrs = await dnsLookup(host, { all: true });
  } catch {
    throw new PostingFetchError("Couldn't resolve that link.");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new PostingFetchError("That address isn't allowed.");
  }
  return url;
}

// ---------- guarded fetch (connection pinned to a validated IP) ----------

// Used as the socket's DNS resolver: resolves once, rejects if ANY returned
// address is private, and hands the connection only validated IPs. Because the
// socket uses THIS resolution (not a second independent one), there's no
// rebinding window between validation and connection.
function guardedLookup(
  hostname: string,
  options: { all?: boolean } & Record<string, unknown>,
  callback: (
    err: Error | null,
    address?: string | { address: string; family: number }[],
    family?: number,
  ) => void,
): void {
  dnsLookup(hostname, { all: true })
    .then((addrs) => {
      if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
        callback(new Error("Address not allowed"));
        return;
      }
      if (options && options.all) {
        callback(null, addrs.map((a) => ({ address: a.address, family: a.family })));
      } else {
        callback(null, addrs[0].address, addrs[0].family);
      }
    })
    .catch(() => callback(new Error("DNS lookup failed")));
}

function requestOnce(
  rawUrl: string,
): Promise<{ status: number; location?: string; body?: string }> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      reject(new PostingFetchError("That doesn't look like a valid link."));
      return;
    }
    const doRequest = url.protocol === "https:" ? httpsRequest : httpRequest;

    let settled = false;
    const overall = setTimeout(() => {
      req.destroy(new PostingFetchError("That link took too long."));
    }, FETCH_TOTAL_MS);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(overall);
      fn();
    };

    const req = doRequest(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as LookupFunction,
        headers: {
          "user-agent": "TailorMeBot/1.0 (+https://tailorme.app; resume tailoring)",
          accept: "text/html,application/xhtml+xml,text/plain",
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume(); // drain
          finish(() => resolve({ status, location: String(res.headers.location) }));
          return;
        }
        const ct = String(res.headers["content-type"] || "").toLowerCase();
        if (!/text\/html|text\/plain|application\/xhtml/.test(ct)) {
          res.destroy();
          finish(() =>
            reject(
              new PostingFetchError(
                "That link isn't a readable web page. Paste the posting text instead.",
              ),
            ),
          );
          return;
        }
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        // maxOutputLength makes zlib error instead of inflating a compression
        // bomb (tiny payload → huge output) past the cap, before it can balloon memory.
        const zopts = { maxOutputLength: MAX_BYTES };
        if (enc.includes("br")) stream = res.pipe(createBrotliDecompress(zopts));
        else if (enc.includes("gzip")) stream = res.pipe(createGunzip(zopts));
        else if (enc.includes("deflate")) stream = res.pipe(createInflate(zopts));

        const chunks: Buffer[] = [];
        let total = 0;
        stream.on("data", (c: Buffer) => {
          if (settled) return;
          if (total + c.length > MAX_BYTES) {
            chunks.push(c.subarray(0, MAX_BYTES - total));
            total = MAX_BYTES;
            req.destroy();
            finish(() => resolve({ status, body: Buffer.concat(chunks).toString("utf-8") }));
            return;
          }
          total += c.length;
          chunks.push(c);
        });
        stream.on("end", () =>
          finish(() => resolve({ status, body: Buffer.concat(chunks).toString("utf-8") })),
        );
        stream.on("error", () =>
          finish(() => reject(new PostingFetchError("Couldn't read that link."))),
        );
      },
    );

    req.on("error", (e) =>
      finish(() =>
        reject(
          e instanceof PostingFetchError
            ? e
            : new PostingFetchError(
                "Couldn't open that link. It was blocked, timed out, or refused the connection.",
              ),
        ),
      ),
    );
    req.setTimeout(FETCH_IDLE_MS, () => {
      req.destroy(new PostingFetchError("That link timed out."));
    });
    req.end();
  });
}

async function fetchHtml(rawUrl: string): Promise<string> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current); // protocol/blocklist/literal-IP; connect is IP-pinned
    const r = await requestOnce(current);
    if (r.status >= 300 && r.status < 400 && r.location) {
      current = new URL(r.location, current).toString(); // re-validated next loop
      continue;
    }
    if (r.status < 200 || r.status >= 300) {
      throw new PostingFetchError(
        `Couldn't open that link (status ${r.status}). Paste the posting text instead.`,
      );
    }
    return r.body ?? "";
  }
  throw new PostingFetchError("That link redirected too many times.");
}

// ---------- HTML → readable text ----------

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
  "&bull;": "•", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&[a-z]+\d*;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/** Prefer the main/article region; fall back to body, then the whole document. */
function pickRegion(html: string): string {
  for (const tag of ["main", "article"]) {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (m && m[1].length > MIN_USEFUL_CHARS) return m[1];
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1] : html;
}

/** Extract readable, posting-like text from an HTML document. Pure. */
export function extractPostingText(html: string): string {
  const region = pickRegion(html);
  const text = region
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head|nav|footer|header|form|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fetch a job posting from a URL and return its readable text + page title. */
export async function fetchPostingText(
  rawUrl: string,
): Promise<{ text: string; title: string; truncated: boolean }> {
  const html = await fetchHtml(rawUrl);
  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();

  let text = extractPostingText(html);
  if (text.length < MIN_USEFUL_CHARS) {
    throw new PostingFetchError(
      "That page didn't return readable text. It may load the posting with JavaScript. Paste the posting text instead.",
    );
  }
  const truncated = text.length > MAX_POSTING_CHARS;
  if (truncated) text = text.slice(0, MAX_POSTING_CHARS);
  return { text, title, truncated };
}
