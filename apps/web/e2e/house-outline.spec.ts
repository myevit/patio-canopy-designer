import { expect, test } from "@playwright/test";

async function drawTriangle(page: import("@playwright/test").Page) {
  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;
  await svg.click({ position: { x: box.width * 0.03, y: box.height * 0.1 } });
  await svg.click({ position: { x: box.width * 0.06, y: box.height * 0.1 } });
  await svg.click({ position: { x: box.width * 0.06, y: box.height * 0.2 } });
}

test("draw a house outline, correct an invalid one, undo/redo, and reload restores it", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "House", exact: true }).click();
  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;

  // Attempt a zero-area (collinear) outline first — must be rejected recoverably.
  await svg.click({ position: { x: box.width * 0.03, y: box.height * 0.1 } });
  await svg.click({ position: { x: box.width * 0.045, y: box.height * 0.1 } });
  await svg.click({ position: { x: box.width * 0.06, y: box.height * 0.1 } });
  await page.getByTestId("house-outline-close-affordance").click();
  await expect(page.getByRole("status")).toContainText(/zero area/i);

  // Correct it by adding a non-collinear point, then close.
  await svg.click({ position: { x: box.width * 0.06, y: box.height * 0.2 } });
  await page.getByTestId("house-outline-close-affordance").click();
  await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");

  const outlineCountBefore = await page.getByLabel(/^House outline/).count();
  expect(outlineCountBefore).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: /undo/i }).click();
  expect(await page.getByLabel(/^House outline/).count()).toBe(outlineCountBefore - 1);

  await page.getByRole("button", { name: /redo/i }).click();
  expect(await page.getByLabel(/^House outline/).count()).toBe(outlineCountBefore);

  await page.reload();
  await expect(page.getByLabel(/^House outline/)).toHaveCount(outlineCountBefore);
});

test("export, clear via New, and re-import restores the project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "House", exact: true }).click();
  await drawTriangle(page);
  await page.getByTestId("house-outline-close-affordance").click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByLabel(/^House outline/)).toHaveCount(0);

  const fs = await import("node:fs/promises");
  const json = await fs.readFile(path!, "utf-8");
  const file = { name: "project.json", mimeType: "application/json", buffer: Buffer.from(json) };
  await page.getByLabel(/import/i).setInputFiles(file);

  await expect(page.getByLabel(/^House outline/)).toHaveCount(1);
});
