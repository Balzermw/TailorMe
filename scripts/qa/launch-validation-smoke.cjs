/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const env = { ...process.env };
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || env[m[1]]) continue;
    env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function maskEmail(email) {
  return email.replace(/(^.).*(@.*$)/, "$1***$2");
}

function stage(name) {
  console.error(`[launch-smoke] ${name}`);
}

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      return;
    } catch {
      // Fall back to Node's process kill below.
    }
  }
  child.kill();
}

function sameSiteForPlaywright(value) {
  if (value === "strict") return "Strict";
  if (value === "none") return "None";
  return "Lax";
}

async function sessionCookiesForBrowser({ createServerClient, env, session, base }) {
  let cookies = [];
  const ssr = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookies;
        },
        setAll(cookiesToSet) {
          cookies = cookiesToSet.map(({ name, value, options }) => ({
            name,
            value,
            options,
          }));
        },
      },
    },
  );

  const { error } = await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    throw new Error(`SSR session cookie creation failed: ${error.message}`);
  }

  const now = Math.floor(Date.now() / 1000);
  return cookies
    .filter((cookie) => cookie.value)
    .map(({ name, value, options }) => ({
      name,
      value,
      url: base,
      httpOnly: Boolean(options?.httpOnly),
      secure: Boolean(options?.secure),
      sameSite: sameSiteForPlaywright(options?.sameSite),
      expires: options?.maxAge ? now + options.maxAge : -1,
    }));
}

async function waitFor(url, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const env = loadEnvLocal();
  const base = process.env.LAUNCH_SMOKE_BASE_URL || "http://127.0.0.1:3101";
  const port = new URL(base).port || "3101";
  const stamp = Date.now();
  const email = `codex-launch-${stamp}@example.com`;
  const password = `CodexLaunch${stamp}!`;
  let userId = null;
  let browser = null;
  let server = null;
  let stoppingServer = false;

  const { createClient } = await import("@supabase/supabase-js");
  const { createServerClient } = await import("@supabase/ssr");
  const Stripe = (await import("stripe")).default;
  const { chromium } = await import("playwright");
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const authClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const result = {
    testUser: maskEmail(email),
    serverStarted: false,
    signedIn: false,
    checkoutSession: null,
    webhookCreditGrant: null,
    webhookIdempotency: null,
    creditSpend: null,
    reviewWebhook: null,
    adminFulfillment: null,
  };

  try {
    stage("creating throwaway Supabase user");
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Codex Launch Test" },
    });
    if (created.error) {
      throw new Error(`createUser failed: ${created.error.message}`);
    }
    userId = created.data.user.id;
    const signedIn = await authClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      throw new Error(`auth client sign-in failed: ${signedIn.error?.message ?? "no session"}`);
    }
    if (!fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"))) {
      throw new Error("Missing production build. Run `npm run build` before launch validation smoke.");
    }

    const serverEnv = {
      ...env,
      NEXT_PUBLIC_APP_URL: base,
      CREDITS_DISABLED: "0",
      RATE_LIMIT_DISABLED: "0",
      ADMIN_EMAILS: `${env.ADMIN_EMAILS || ""},${email}`,
      REQUIRE_LIVE_AI_PARSE: "1",
    };
    server = spawn(
      "cmd.exe",
      ["/c", "npm", "run", "start", "--", "--port", port],
      {
        cwd: process.cwd(),
        env: serverEnv,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let serverLog = "";
    server.stdout.on("data", (d) => {
      serverLog += d.toString();
    });
    server.stderr.on("data", (d) => {
      serverLog += d.toString();
    });
    server.on("exit", (code) => {
      if (!stoppingServer && code && code !== 0) {
        console.error(`server exited ${code}: ${serverLog.slice(-1000)}`);
      }
    });
    await waitFor(base, 90_000);
    result.serverStarted = true;
    stage(`server ready at ${base}`);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ baseURL: base });
    page.setDefaultTimeout(45_000);

    stage("injecting authenticated Supabase SSR cookies");
    const cookies = await sessionCookiesForBrowser({
      createServerClient,
      env,
      session: signedIn.data.session,
      base,
    });
    stage(`prepared ${cookies.length} SSR cookie(s)`);
    await page.context().addCookies(cookies);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    const visibleCookieNames = await page.evaluate(() =>
      document.cookie
        .split(";")
        .map((part) => part.trim().split("=")[0])
        .filter(Boolean),
    );
    stage(`browser sees ${visibleCookieNames.length} cookie(s)`);
    result.signedIn = true;

    const beforeProfile = await admin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    if (beforeProfile.error) {
      throw new Error(`profile read failed: ${beforeProfile.error.message}`);
    }

    stage("creating credits checkout session");
    const checkout = await page.evaluate(async () => {
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: "starter",
          addOns: ["expert_feedback"],
        }),
      });
      const data = await res.json();
      return { status: res.status, data };
    });
    if (checkout.status !== 200 || !checkout.data.url) {
      throw new Error(`checkout failed: ${JSON.stringify(checkout)}`);
    }

    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
      created: { gte: Math.floor(stamp / 1000) - 5 },
    });
    const session = sessions.data.find(
      (s) => s.metadata?.userId === userId && s.metadata?.kind === "credits",
    );
    if (!session) {
      throw new Error("created checkout session not found in Stripe test account");
    }
    result.checkoutSession = {
      created: true,
      livemode: session.livemode,
      amountTotal: session.amount_total,
      planSlug: session.metadata.planSlug,
      credits: Number(session.metadata.credits),
      expertFeedback: session.metadata.expertFeedback === "1",
    };

    stage("posting signed credits webhook");
    const payload = JSON.stringify({
      id: `evt_codex_${stamp}`,
      object: "event",
      api_version: "2026-05-27.dahlia",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "checkout.session.completed",
      data: { object: session },
    });
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });
    const hook1 = await fetch(`${base}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": sig,
        "content-type": "application/json",
      },
      body: payload,
    });
    if (!hook1.ok) {
      throw new Error(`webhook credit grant failed: ${hook1.status} ${await hook1.text()}`);
    }

    const afterGrant = await admin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    const order = await admin
      .from("orders")
      .select(
        "id,credits,total_cents,expert_feedback,human_revision,fulfillment_status,stripe_session_id",
      )
      .eq("stripe_session_id", session.id)
      .single();
    if (order.error) {
      throw new Error(`order read failed: ${order.error.message}`);
    }
    result.webhookCreditGrant = {
      creditsBefore: beforeProfile.data.credits,
      creditsAfter: afterGrant.data.credits,
      orderTotalCents: order.data.total_cents,
      orderPending: order.data.fulfillment_status === "pending",
    };

    stage("replaying credits webhook for idempotency");
    const hook2 = await fetch(`${base}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": sig,
        "content-type": "application/json",
      },
      body: payload,
    });
    if (!hook2.ok) {
      throw new Error(`webhook idempotency replay failed: ${hook2.status}`);
    }
    const afterReplay = await admin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    const replayOrders = await admin
      .from("orders")
      .select("id", { count: "exact" })
      .eq("stripe_session_id", session.id);
    result.webhookIdempotency = {
      creditsAfterReplay: afterReplay.data.credits,
      orderRowsForSession: replayOrders.count,
    };

    stage("spending one purchased credit through authenticated RPC");
    const spent = await authClient.rpc("consume_credit");
    if (spent.error || spent.data !== true) {
      throw new Error(`consume_credit failed: ${spent.error?.message ?? spent.data}`);
    }
    const afterSpend = await admin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();
    if (afterSpend.error) {
      throw new Error(`post-spend profile read failed: ${afterSpend.error.message}`);
    }
    result.creditSpend = {
      consumed: true,
      creditsAfterSpend: afterSpend.data.credits,
    };

    stage("inserting synthetic ready application for review checkout");
    const readyApp = await admin
      .from("applications")
      .insert({
        user_id: userId,
        company: "Codex Systems",
        role: "Senior Platform Engineer",
        posting: "Synthetic launch validation posting.",
        fit_score: 82,
        status: "ready",
        result: {
          company: "Codex Systems",
          role: "Senior Platform Engineer",
          fit: { overall: 82, verdict: "Strong fit" },
          doc: {
            name: "Jordan Rivera",
            headline: "Platform Engineer",
            contact: "Portland, OR",
            summary: "Platform engineer with reliability and deployment experience.",
            experience: [
              {
                role: "Platform Engineer",
                company: "Northstar Tools",
                dates: "2022 - Present",
                bullets: ["Reduced recurring incidents by 18%."],
              },
            ],
            education: [],
            skills: ["Node.js", "Kubernetes", "AWS"],
            coverLetter: "",
          },
        },
      })
      .select("id")
      .single();
    if (readyApp.error) {
      throw new Error(`synthetic application insert failed: ${readyApp.error.message}`);
    }

    stage("creating review checkout session");
    const review = await page.evaluate(async (appId) => {
      const res = await fetch(`/api/applications/${appId}/request-review`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      return { status: res.status, data };
    }, readyApp.data.id);
    if (review.status !== 200 || !review.data.url) {
      throw new Error(`request-review failed: ${JSON.stringify(review)}`);
    }
    const reviewSessions = await stripe.checkout.sessions.list({
      limit: 10,
      created: { gte: Math.floor(stamp / 1000) - 5 },
    });
    const reviewSession = reviewSessions.data.find(
      (s) =>
        s.metadata?.userId === userId &&
        s.metadata?.kind === "review" &&
        s.metadata?.applicationId === readyApp.data.id,
    );
    if (!reviewSession) {
      throw new Error("review checkout session not found in Stripe test account");
    }
    stage("posting signed review webhook");
    const reviewPayload = JSON.stringify({
      id: `evt_codex_review_${stamp}`,
      object: "event",
      api_version: "2026-05-27.dahlia",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "checkout.session.completed",
      data: { object: reviewSession },
    });
    const reviewSig = stripe.webhooks.generateTestHeaderString({
      payload: reviewPayload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });
    const reviewHook = await fetch(`${base}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "stripe-signature": reviewSig,
        "content-type": "application/json",
      },
      body: reviewPayload,
    });
    if (!reviewHook.ok) {
      throw new Error(`review webhook failed: ${reviewHook.status} ${await reviewHook.text()}`);
    }
    const appRow = await admin
      .from("applications")
      .select("status,michael_status")
      .eq("id", readyApp.data.id)
      .single();
    if (appRow.error) {
      throw new Error(`application read failed: ${appRow.error.message}`);
    }
    result.reviewWebhook = {
      checkoutCreated: true,
      applicationStatus: appRow.data.status,
      michaelStatus: appRow.data.michael_status,
    };

    stage("marking add-on order fulfilled through admin API");
    const adminUpdate = await page.evaluate(async (orderId) => {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = await res.json();
      return { status: res.status, data };
    }, order.data.id);
    if (adminUpdate.status !== 200 || adminUpdate.data.status !== "done") {
      throw new Error(`admin update failed: ${JSON.stringify(adminUpdate)}`);
    }
    const fulfilled = await admin
      .from("orders")
      .select("fulfillment_status")
      .eq("id", order.data.id)
      .single();
    result.adminFulfillment = {
      apiStatus: adminUpdate.status,
      fulfillmentStatus: fulfilled.data.fulfillment_status,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
    try {
      if (userId) {
        stage("cleaning launch-test database rows");
        await admin.from("orders").delete().eq("user_id", userId);
        await admin.from("product_events").delete().eq("user_id", userId);
        await admin.from("ai_runs").delete().eq("user_id", userId);
        await admin.from("applications").delete().eq("user_id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    } catch (e) {
      console.error(JSON.stringify({ cleanupError: e.message }, null, 2));
    }
    try {
      if (server) {
        stoppingServer = true;
        killProcessTree(server);
      }
    } catch {}
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        launchValidationFailed: true,
        message: error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
