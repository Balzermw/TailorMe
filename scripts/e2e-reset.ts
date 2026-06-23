import fs from "node:fs/promises";
import path from "node:path";

const targets = [
  path.join(process.cwd(), "test-results"),
  path.join(process.cwd(), "playwright-report"),
  path.join(process.cwd(), "tests", "e2e", "results"),
];

async function main(): Promise<void> {
  for (const target of targets) {
    if (!target.startsWith(process.cwd())) {
      throw new Error(`Refusing to remove outside workspace: ${target}`);
    }
    await fs.rm(target, { recursive: true, force: true });
  }
  console.log("Removed local E2E result artifacts.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
