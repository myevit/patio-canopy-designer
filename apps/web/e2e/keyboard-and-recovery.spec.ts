import { expect, test } from "@playwright/test";

test("draws a house outline entirely via the keyboard (no pointer input)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByLabel(/^House outline/)).toHaveCount(0);

  await page.getByRole("button", { name: "House", exact: true }).focus();
  await page.keyboard.press("Enter");

  async function addPointViaKeyboard(x: string, y: string) {
    const xField = page.getByLabel(/^x \(mm\)/i);
    await xField.fill(x);
    const yField = page.getByLabel(/^y \(mm\)/i);
    await yField.fill(y);
    const addButton = page.getByRole("button", { name: /^add point$/i });
    await addButton.focus();
    await page.keyboard.press("Enter");
  }

  await addPointViaKeyboard("0", "0");
  await addPointViaKeyboard("4000", "0");
  await addPointViaKeyboard("4000", "3000");

  const closeButton = page.getByRole("button", { name: /close outline/i });
  await expect(closeButton).toBeEnabled();
  await closeButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel(/^House outline/)).toHaveCount(1);
});

test("places two posts and connects them with a beam entirely via the keyboard (no pointer input)", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const posts = page.locator('[data-testid^="scene-object-post-"]');
  const beams = page.locator('[data-testid^="scene-object-member-"]');

  async function placePostViaKeyboard(x: string, y: string) {
    const xField = page.getByLabel(/^x \(mm\)/i);
    await xField.fill(x);
    const yField = page.getByLabel(/^y \(mm\)/i);
    await yField.fill(y);
    const addButton = page.getByRole("button", { name: /^add post$/i });
    await addButton.focus();
    await page.keyboard.press("Enter");
  }

  await page.getByRole("button", { name: "Post", exact: true }).focus();
  await page.keyboard.press("Enter");
  await placePostViaKeyboard("2000", "2000");
  await placePostViaKeyboard("5000", "2000");
  await expect(posts).toHaveCount(2);

  await page.getByRole("button", { name: "Beam", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(/start anchor/i);
  await posts.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(/end anchor/i);
  await posts.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(beams).toHaveCount(1);

  expect(pageErrors).toEqual([]);
});

test("moving a vertex updates the plan polygon and the 3D view renders the same revision without error", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const outlineId = "house-outline-1";
  const vertex0 = page.getByTestId(`house-vertex-${outlineId}-0`);
  await vertex0.click();

  const xField = page.getByLabel(/vertex x/i);
  await xField.fill("-1234");
  await xField.blur();

  const polygon = page.getByTestId(`house-outline-${outlineId}`);
  await expect(polygon).toHaveAttribute("points", /-1234/);

  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByTestId("plan-view-svg")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(polygon).toHaveAttribute("points", /-1234/);

  expect(pageErrors).toEqual([]);
});

test("a corrupt IndexedDB autosave record recovers to a usable app instead of crashing", async ({ page }) => {
  await page.goto("/");

  // Let the app create its "canopy-studio" database, then overwrite the
  // autosave record with something that fails schema/outline validation.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("canopy-studio");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").put({ id: "autosave", document: { not: "a valid project document" } });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.reload();

  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
  await expect(page.getByTestId("plan-view-svg")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
