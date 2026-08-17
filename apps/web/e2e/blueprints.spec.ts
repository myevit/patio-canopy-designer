import { expect, test } from "@playwright/test";

test("drawing a small frame produces a blueprint sheet with callouts resolving to live objects, and Print triggers the browser print flow", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
    };
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;

  // Place two posts and connect them with a beam.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await svg.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
  const posts = page.locator('[data-testid^="scene-object-post-"]');
  await expect(posts).toHaveCount(2);

  await page.getByRole("button", { name: "Beam", exact: true }).click();
  await posts.nth(0).click();
  await posts.nth(1).click();
  const beams = page.locator('[data-testid^="scene-object-member-"]');
  await expect(beams).toHaveCount(1);

  const beamTestId = await beams.first().getAttribute("data-testid");
  const memberId = beamTestId!.replace("scene-object-", "");
  const postTestIds = await posts.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-testid")));
  const postIds = postTestIds.map((id) => id!.replace("scene-object-", ""));

  // Open the Blueprints tab.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("tab", { name: "Blueprints" }).click();
  const panel = page.getByRole("region", { name: "Blueprints" });
  await expect(panel).toBeVisible();

  // Each member's outline is drawn (and marked) in every view that shows it -
  // plan, elevations, and (when it crosses the cut plane) the section - so
  // at least one instance must resolve back to the live beam and each post.
  await expect(panel.getByTestId(`blueprint-member-${memberId}`).first()).toBeVisible();
  expect(await panel.getByTestId(`blueprint-member-${memberId}`).count()).toBeGreaterThan(0);
  for (const postId of postIds) {
    expect(await panel.getByTestId(`blueprint-member-${postId}`).count()).toBeGreaterThan(0);
  }

  // The title block carries model-sourced revision metadata, not placeholder text.
  const titleBlock = panel.getByTestId("blueprint-title-block");
  await expect(titleBlock).toContainText(/rev(ision)?\s*\d+/i);
  await expect(titleBlock).toContainText(/1:\d/);
  await expect(titleBlock).toContainText(/sheet\s*1\s*of\s*2/i);

  // Printing the sheet reuses the browser print flow, same as BOM/Cuts.
  await panel.getByRole("button", { name: "Print" }).click();
  const printCalls = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
  expect(printCalls).toBe(1);

  // The schedule sheet is reachable and lists no unresolved items for this fully-connected frame.
  await panel.getByRole("button", { name: /next/i }).click();
  await expect(panel.getByTestId("blueprint-unresolved-schedule")).toContainText(/no unresolved items/i);

  expect(pageErrors).toEqual([]);
});
