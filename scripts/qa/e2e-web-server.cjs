/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");
const { spawn, spawnSync } = require("child_process");

const cwd = process.cwd();
const port = process.argv[2] || process.env.PORT || "3100";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const buildCommand =
  process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", "npm run build"] }
    : { command: npmBin, args: ["run", "build"] };

function log(message) {
  console.error(`[e2e-web-server] ${message}`);
}

function killProcessTree(child, force = false) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    const result = spawnSync(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T"].concat(force ? ["/F"] : []),
      { stdio: "ignore" },
    );
    if (result.status === 0) return;
  }
  try {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  } catch {
    // Process already exited.
  }
}

log("building Next app");
let build = spawnSync(buildCommand.command, buildCommand.args, {
  cwd,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

if (build.error) {
  log(`npm build did not start: ${build.error.message}`);
  log("falling back to direct next build");
  build = spawnSync(process.execPath, [nextBin, "build"], {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}

if (build.error) {
  log(`direct next build did not start: ${build.error.message}`);
  process.exit(1);
}

if (build.signal) {
  log(`build stopped with signal ${build.signal}`);
  process.exit(1);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

log(`starting Next app on port ${port}`);
const server = spawn(process.execPath, [nextBin, "start", "--port", port], {
  cwd,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;

function shutdown() {
  if (stopping) return;
  stopping = true;
  log("stopping Next app");
  killProcessTree(server, false);
  setTimeout(() => {
    killProcessTree(server, true);
    process.exit(0);
  }, 2_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => {
  if (!stopping) killProcessTree(server, true);
});

server.on("exit", (code, signal) => {
  if (stopping) {
    process.exit(0);
    return;
  }
  if (signal) {
    log(`Next app exited with signal ${signal}`);
    process.exit(1);
    return;
  }
  process.exit(code ?? 0);
});
