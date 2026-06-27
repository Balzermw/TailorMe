import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3100";

const webServerPort = new URL(baseURL).port || "3100";

const realCorpusMode = process.env.RUN_REAL_RESUME_CORPUS === "1";
const captureRealResumeMedia = process.env.CAPTURE_REAL_RESUME_SCREENSHOTS === "1";
const liveAiMode = process.env.RUN_LIVE_AI_E2E === "1";
const liveRevisionMode = process.env.RUN_REAL_RESUME_REVISION_UI === "1";
const skipWebServer = process.env.E2E_SKIP_WEB_SERVER === "1";
const aiProviderEnv: Record<string, string> = liveAiMode
  ? {}
  : { OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" };
const supabaseEnv: Record<string, string> = liveRevisionMode
  ? {}
  : {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    };
const blockedTags: string[] = [];

if (!realCorpusMode) blockedTags.push("@real-corpus");
if (!liveAiMode) blockedTags.push("@live-ai");

const grepInvert =
  blockedTags.length > 0
    ? new RegExp(blockedTags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"))
    : undefined;

export default defineConfig({
  testDir: "./tests/e2e/specs",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  grepInvert,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: realCorpusMode && !captureRealResumeMedia ? "off" : "only-on-failure",
    video: realCorpusMode && !captureRealResumeMedia ? "off" : "retain-on-failure",
    trace: realCorpusMode && !captureRealResumeMedia ? "off" : "on-first-retry",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command:
          process.env.E2E_WEB_SERVER_COMMAND ||
          `node scripts/qa/e2e-web-server.cjs ${webServerPort}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          E2E_TEST_MODE: "1",
          RUN_LIVE_AI_E2E: liveAiMode ? "1" : "0",
          REQUIRE_LIVE_AI_PARSE: liveAiMode ? "1" : "0",
          RUN_REAL_RESUME_CORPUS: realCorpusMode ? "1" : "0",
          CAPTURE_REAL_RESUME_SCREENSHOTS: captureRealResumeMedia ? "1" : "0",
          RATE_LIMIT_DISABLED: "1",
          CREDITS_DISABLED: "1",
          NEXT_PUBLIC_SHOW_SAMPLE_WORKFLOWS:
            process.env.NEXT_PUBLIC_SHOW_SAMPLE_WORKFLOWS ?? "1",
          NEXT_PUBLIC_APP_URL: baseURL,
          E2E_BASE_URL: baseURL,
          ...supabaseEnv,
          STRIPE_SECRET_KEY: "",
          STRIPE_WEBHOOK_SECRET: "",
          LATEX_COMPILE_URL: "",
          ...aiProviderEnv,
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
});
