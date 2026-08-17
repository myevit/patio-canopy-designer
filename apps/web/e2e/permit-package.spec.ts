import { expect, test } from "@playwright/test";

test("assembles a permit-assist package that stays consistent with the BOM and analysis tabs, and always shows the no-approval/no-stamp disclaimer", async ({
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

  // Build the canonical simply-supported case: two posts joined by one beam.
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
  await page.getByRole("button", { name: "Select", exact: true }).click();

  const beamTestId = await beams.first().getAttribute("data-testid");
  const memberId = beamTestId!.replace("scene-object-", "");
  const postTestIds = await posts.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-testid")));
  const postIds = postTestIds.map((id) => id!.replace("scene-object-", ""));

  // The BOM tab is the reference truth for the member schedule.
  await page.getByRole("tab", { name: "BOM" }).click();
  const bomPanel = page.getByRole("region", { name: "Bill of materials" });
  await expect(bomPanel.getByTestId(`bom-member-${memberId}`)).toBeVisible();

  // Open the Permit package tab.
  await page.getByRole("tab", { name: "Permit package" }).click();
  const permitPanel = page.getByRole("region", { name: "Permit package" });
  await expect(permitPanel).toBeVisible();

  // The no-approval / no-stamp disclaimer is always visible.
  const disclaimer = permitPanel.getByTestId("permit-package-disclaimer");
  await expect(disclaimer).toContainText(/not a permit approval/i);
  await expect(disclaimer).toContainText(/does not claim code compliance/i);
  await expect(disclaimer).toContainText(/never applies.*stamp/i);

  // The engineer-review-required banner for the attached irregular saddle is always shown.
  await expect(permitPanel.getByText(/attached irregular saddle/i).first()).toBeVisible();

  // Cross-sheet consistency: the member schedule in the permit package lists
  // exactly the same member the BOM tab lists, and the structural summary
  // lists every drawn member/post, none silently dropped.
  await expect(permitPanel.getByTestId(`permit-member-${memberId}`)).toBeVisible();
  await expect(permitPanel.getByTestId(`permit-structural-member-${memberId}`)).toContainText(/not-yet-analyzed/i);
  for (const postId of postIds) {
    await expect(permitPanel.getByTestId(`permit-footing-${postId}`)).toBeAttached();
    await expect(permitPanel.getByTestId(`permit-structural-post-${postId}`)).toBeAttached();
  }

  // The dimensioned plan/elevations sheet reuses the same blueprint projection
  // engine as the Blueprints tab: the beam's outline resolves inside it.
  await expect(permitPanel.getByTestId(`blueprint-member-${memberId}`).first()).toBeVisible();

  // Entering a site address updates its provenance from "not provided" to "user-entered".
  await expect(permitPanel.getByTestId("permit-site-address")).toContainText(/not provided/i);
  await permitPanel.getByLabel(/^address/i).fill("123 Sample Street NW, Edmonton, AB");
  await expect(permitPanel.getByTestId("permit-site-address")).toContainText("123 Sample Street NW, Edmonton, AB");

  // Running a component check in the Analysis tab is reproduced verbatim in
  // the permit package's structural summary - proving the two tabs share the
  // same underlying result rather than each computing their own.
  await page.getByRole("tab", { name: "Analysis" }).click();
  const analysisPanel = page.getByRole("region", { name: "Component analysis" });
  await analysisPanel.getByLabel(/applied uniform load/i).fill("10");
  await analysisPanel.getByLabel(/elastic modulus/i).fill("10000");
  await analysisPanel.getByLabel(/moment of inertia/i).fill("100000000");
  await analysisPanel.getByRole("button", { name: /run member check/i }).click();
  await expect(page.getByTestId("member-analysis-report")).toContainText(/calculated-within-stated-assumptions/i);

  await page.getByRole("tab", { name: "Permit package" }).click();
  await expect(permitPanel.getByTestId(`permit-structural-member-${memberId}`)).toContainText(
    /calculated-within-stated-assumptions/i,
  );

  // Printing reuses the browser print flow, same as BOM/Blueprints.
  await permitPanel.getByRole("button", { name: "Print" }).click();
  const printCalls = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
  expect(printCalls).toBe(1);

  // Print always emits the full package regardless of the on-screen state.
  const printPackage = permitPanel.getByTestId("permit-print-package");
  await expect(printPackage).toBeAttached();
  await expect(permitPanel.getByTestId("permit-print-page-summary")).toContainText(/not a permit approval/i);
  await expect(permitPanel.getByTestId("permit-print-page-drawings").getByTestId("blueprint-print-package")).toBeAttached();

  // Under real print media, the screen content hides and the print package shows.
  await page.emulateMedia({ media: "print" });
  await expect(printPackage).toBeVisible();
  await expect(permitPanel.locator(".permit-package-panel__screen")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  expect(pageErrors).toEqual([]);
});
