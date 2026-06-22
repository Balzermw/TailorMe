// Fire-and-forget product telemetry. Records what users click so we can base
// design + usage decisions on real behavior. Safe to call anywhere on the
// client. NEVER pass résumé content or PII — props are bounded server-side too,
// and the endpoint only stores allowlisted event names.

let cachedSid: string | null = null;

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

export function track(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ name, props: props ?? {}, sessionId: sessionId() });
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
    /* telemetry must never break the app */
  }
}
