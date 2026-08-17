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
  const activeSheet = panel.getByTestId("blueprint-active-sheet");

  // Each member's outline is drawn (and marked) in every view that shows it -
  // plan, elevations, and (when it crosses the cut plane) the section - so
  // at least one instance must resolve back to the live beam and each post.
  await expect(activeSheet.getByTestId(`blueprint-member-${memberId}`).first()).toBeVisible();
  expect(await activeSheet.getByTestId(`blueprint-member-${memberId}`).count()).toBeGreaterThan(0);
  for (const postId of postIds) {
    expect(await activeSheet.getByTestId(`blueprint-member-${postId}`).count()).toBeGreaterThan(0);
  }

  // The title block carries model-sourced revision metadata, not placeholder
  // text, and the on-screen preview keeps its intended computed scale for reference.
  const titleBlock = activeSheet.getByTestId("blueprint-title-block");
  await expect(titleBlock).toContainText(/rev(ision)?\s*\d+/i);
  await expect(titleBlock).toContainText(/1:\d/);
  await expect(titleBlock).toContainText(/sheet\s*1\s*of\s*2/i);

  // Printing the sheet reuses the browser print flow, same as BOM/Cuts.
  await panel.getByRole("button", { name: "Print" }).click();
  const printCalls = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
  expect(printCalls).toBe(1);

  // Print always emits the full two-sheet package - drawing plus schedule -
  // regardless of which sheet happens to be active in the on-screen preview,
  // and each printed sheet honestly labels its scale as indicative rather
  // than asserting an exact fit on arbitrary paper.
  const printPage1 = panel.getByTestId("blueprint-print-page-1");
  const printPage2 = panel.getByTestId("blueprint-print-page-2");
  await expect(printPage1).toBeAttached();
  await expect(printPage2).toBeAttached();
  await expect(printPage1.getByTestId("blueprint-title-block-scale")).toHaveText(/indicative/i);
  await expect(printPage2.getByTestId("blueprint-title-block-scale")).toHaveText(/indicative/i);
  await expect(printPage1.getByTestId("blueprint-print-scale-footnote")).toBeAttached();
  await expect(printPage2.getByTestId("blueprint-print-scale-footnote")).toBeAttached();

  // Under real print media: the package becomes visible (and the on-screen
  // preview hides), A3 landscape sizing is applied, and only the second
  // sheet carries a page-break-before - proving there is no leading break
  // (before sheet 1) and no trailing break (after sheet 2, i.e. no blank page).
  await page.emulateMedia({ media: "print" });
  await expect(panel.getByTestId("blueprint-print-package")).toBeVisible();
  await expect(activeSheet.locator(".blueprint-sheet--screen")).toBeHidden();
  const breakInfo = await page.evaluate(() => {
    const style = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const first = document.querySelector('[data-testid="blueprint-print-page-1"]');
    const second = document.querySelector('[data-testid="blueprint-print-page-2"]');
    return {
      firstBreakBefore: style(first)?.breakBefore,
      secondBreakBefore: style(second)?.breakBefore,
      secondBreakAfter: style(second)?.breakAfter,
    };
  });
  expect(breakInfo.firstBreakBefore).not.toBe("page");
  expect(breakInfo.secondBreakBefore).toBe("page");
  expect(breakInfo.secondBreakAfter).not.toBe("page");
  await page.emulateMedia({ media: "screen" });

  // The schedule sheet is reachable and lists no unresolved items for this fully-connected frame.
  await panel.getByRole("button", { name: /next/i }).click();
  await expect(activeSheet.getByTestId("blueprint-unresolved-schedule")).toContainText(/no unresolved items/i);

  expect(pageErrors).toEqual([]);
});
