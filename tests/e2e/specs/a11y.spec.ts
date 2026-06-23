import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../helpers/test";

const a11yRoutes = ["/", "/audit", "/resume/new", "/signin", "/pricing"];

for (const route of a11yRoutes) {
  test(`@a11y critical accessibility scan for ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach(`axe-${route.replace(/\W+/g, "-")}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
  });
}
