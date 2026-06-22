// Fire-and-forget product telemetry. Records low-frequency, decision-oriented
// interactions so product/pricing decisions come from real usage. Safe to call
// anywhere on the client. NEVER pass résumé/job content or PII — the server
// allowlists event names and bounds props. Events queue and flush in small
// batches (and on page hide), so this never blocks or floods the network.

type Ev = {
  name: string;
  props?: Record<string, string | number | boolean>;
  sessionId: string | null;
};

const MAX_BATCH = 10;
let cachedSid: string | null = null;
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function sessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (cachedSid) return cachedSid;
    let s = window.sessionStorage.getItem("tm_sid");
    if (!s) {
      s = crypto.randomUUID();
      window.sessionStorage.setItem("tm_sid", s);
    }
    cachedSid = s;
    return s;
  } catch {
    return null;
  }
}

/** The per-session id, for tagging server-side AI runs (passed as a header). */
export function getSessionId(): string | null {
  return sessionId();
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (typeof window === "undefined" || !queue.length) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  try {
    const payload = batch.length === 1 ? batch[0] : batch;
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* never break the app */
  }
  if (queue.length) flush(); // drain remaining batches
}

function ensureListeners(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function track(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    ensureListeners();
    queue.push({ name, props, sessionId: sessionId() });
    if (queue.length >= MAX_BATCH) {
      flush();
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 4000);
    }
  } catch {
    /* telemetry must never break the app */
  }
}
