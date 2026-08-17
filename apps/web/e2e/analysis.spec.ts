import { expect, test } from "@playwright/test";

test("opens Analysis on a simple two-post frame, enters load inputs, and sees a labeled component check summary with engineer-review disclaimers", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const posts = page.locator('[data-testid^="scene-object-post-"]');
  const beams = page.locator('[data-testid^="scene-object-member-"]');

  // Build the canonical simply-supported case: two posts joined by one beam.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;
  await svg.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
  await expect(posts).toHaveCount(2);

  await page.getByRole("button", { name: "Beam", exact: true }).click();
  await posts.nth(0).click();
  await posts.nth(1).click();
  await expect(beams).toHaveCount(1);
  await page.getByRole("button", { name: "Select", exact: true }).click();

  // Open the Analysis tab.
  await page.getByRole("tab", { name: "Analysis" }).click();
  const analysisPanel = page.getByRole("region", { name: "Component analysis" });
  await expect(analysisPanel).toBeVisible();

  // Preliminary-planning / engineer-review disclaimer is always visible.
  await expect(page.getByRole("note", { name: /preliminary planning disclaimer/i })).toContainText(
    /not a professional engineering approval/i,
  );

  // The beam is eligible for the simply-supported closed-form check.
  await expect(analysisPanel.getByText(/no member is in an explicitly supported analysis scope/i)).toHaveCount(0);

  // Enter load inputs and run the member check.
  await analysisPanel.getByLabel(/applied uniform load/i).fill("10");
  await analysisPanel.getByLabel(/elastic modulus/i).fill("10000");
  await analysisPanel.getByLabel(/moment of inertia/i).fill("100000000");
  await analysisPanel.getByRole("button", { name: /run member check/i }).click();

  const memberReport = page.getByTestId("member-analysis-report");
  await expect(memberReport).toContainText("calculated-within-stated-assumptions");
  await expect(memberReport).toContainText(/engineer-review-required/i);
  await expect(memberReport).toContainText(/span/i);

  expect(pageErrors).toEqual([]);
});
