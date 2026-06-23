import { inventoryControls } from "../../../scripts/qa/inventory-controls";
import { test, expect } from "../helpers/test";

test("@controls generates the visible-control acceptance matrix", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Control inventory is generated once from desktop Chromium.");
  const controls = await inventoryControls();
  expect(controls.length).toBeGreaterThan(20);
  expect(controls.some((control) => control.pageRoute === "/audit")).toBeTruthy();
});
