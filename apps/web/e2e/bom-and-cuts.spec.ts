import { expect, test } from "@playwright/test";

test("drawing a frame with a sloped roof plane produces BOM rows and a roof-plane cut card", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;

  // Draw a small house outline.
  await page.getByRole("button", { name: "House", exact: true }).click();
  await svg.click({ position: { x: box.width * 0.3, y: box.height * 0.2 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.2 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.4 } });
  await svg.click({ position: { x: box.width * 0.3, y: box.height * 0.4 } });
  await page.getByTestId("house-outline-close-affordance").click();

  // Give the house outline a sloped roof plane.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByLabel(/^House outline/).click();
  await page.getByRole("button", { name: /add roof plane/i }).click();

  // Place a post away from the house.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await svg.click({ position: { x: box.width * 0.45, y: box.height * 0.8 } });
  const posts = page.locator('[data-testid^="scene-object-post-"]');
  await expect(posts).toHaveCount(1);

  // Draw a beam from the post top to a point on the roof plane's gutter, so
  // that end of the member sits exactly on the canonical roof plane.
  await page.getByRole("button", { name: "Beam", exact: true }).click();
  await posts.first().click();
  const gutter = page.locator('[data-testid^="gutter-"]').first();
  await expect(gutter).toHaveCount(1);
  // The gutter line has no visible stroke, so it has no pointer hit area;
  // drive its documented keyboard affordance (tabIndex + Enter/Space) instead
  // of a mouse click, which real keyboard users rely on for the same action.
  await gutter.focus();
  await gutter.press("Enter");

  const beams = page.locator('[data-testid^="scene-object-member-"]');
  await expect(beams).toHaveCount(1);

  // The BOM tab lists rows traceable back to the post and the new beam.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("tab", { name: "BOM" }).click();
  const bomPanel = page.getByRole("region", { name: "Bill of materials" });
  await expect(bomPanel.locator("tbody tr")).not.toHaveCount(0);
  await expect(bomPanel).toContainText(/post/i);

  // The Cuts tab shows a per-member cut card sourced from the roof plane.
  await page.getByRole("tab", { name: "Cuts" }).click();
  const cutsPanel = page.getByRole("region", { name: "Cut list" });
  await expect(cutsPanel).toContainText(/roof plane roof-plane-/i);

  expect(pageErrors).toEqual([]);
});
