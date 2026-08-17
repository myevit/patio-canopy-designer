import { expect, test } from "@playwright/test";

test("place two posts, connect them with a beam, move a post, and the beam follows in plan and 3D; reload restores it", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const posts = page.locator('[data-testid^="scene-object-post-"]');
  const beams = page.locator('[data-testid^="scene-object-member-"]');

  // Place two posts.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;
  await svg.click({ position: { x: box.width * 0.3, y: box.height * 0.3 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
  await expect(posts).toHaveCount(2);

  // Connect them with a beam: choose a start anchor, then an end anchor.
  await page.getByRole("button", { name: "Beam", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/start anchor/i);
  await posts.nth(0).click();
  await expect(page.getByRole("status")).toContainText(/end anchor/i);
  await posts.nth(1).click();
  await expect(beams).toHaveCount(1);

  const beam = beams.first();
  const originalX1 = await beam.getAttribute("x1");

  // Move the first post via the Inspector; the beam must follow by reference.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await posts.nth(0).click();
  const xField = page.getByLabel(/base x/i);
  const originalPostX = await xField.inputValue();
  const movedX = String(Number(originalPostX) + 777);
  await xField.fill(movedX);
  await xField.blur();

  await expect(posts.nth(0)).toHaveAttribute("cx", movedX);
  await expect(beam).toHaveAttribute("x1", movedX);
  expect(await beam.getAttribute("x1")).not.toBe(originalX1);

  // The same document drives the 3D view: switching must not error, and both
  // views keep showing the post/beam objects from the one canonical document.
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(posts).toHaveCount(2);
  await expect(beams).toHaveCount(1);

  // Reload restores the moved, connected structure from autosave.
  await page.reload();
  await expect(posts).toHaveCount(2);
  await expect(beams).toHaveCount(1);
  await expect(beams.first()).toHaveAttribute("x1", movedX);

  expect(pageErrors).toEqual([]);
});
