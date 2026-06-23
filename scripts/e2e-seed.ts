import { ensureSyntheticResumeFixtures } from "../tests/e2e/helpers/fixtures";

async function main(): Promise<void> {
  const fixtures = await ensureSyntheticResumeFixtures();
  console.log(`Prepared ${fixtures.length} synthetic resume fixtures.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
