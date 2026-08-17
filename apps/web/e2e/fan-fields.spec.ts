import { expect, test } from "@playwright/test";

test("Fan tool: creating an editable fan field shows its derived members in Plan and 3D, and reload restores it", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const rafters = page.locator('[data-testid^="scene-object-fan-field-"]');
  await expect(rafters).toHaveCount(0);

  // Choose a source anchor (a post top), then a target member, previewing the
  // fan envelope before it is committed.
  await page.getByRole("button", { name: "Fan", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/fan source anchor/i);
  await page.getByTestId("scene-object-post-1").click();
  await expect(page.getByRole("status")).toContainText(/fan target/i);
  await page.getByTestId("scene-object-member-perim-2").click();

  const commitButton = page.getByRole("button", { name: /commit fan field/i });
  await expect(commitButton).toBeVisible();
  await commitButton.click();

  // Committing creates the default member count (5) as real, individually
  // selectable derived rafters, immediately visible in Plan.
  await expect(rafters).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");

  // The same canonical document drives 3D: switching views must not error,
  // and the plan still shows all 5 derived rafters from that one document.
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(rafters).toHaveCount(5);

  // Selecting a derived rafter surfaces the parent fan field's editable
  // count/spacing/reversed/elevation fields in the Inspector.
  await page.getByRole("button", { name: "Plan" }).click();
  await rafters.first().click({ force: true });
  const countField = page.getByLabel(/^count$/i);
  await expect(countField).toHaveValue("5");
  await countField.fill("3");
  await countField.blur();
  await expect(rafters).toHaveCount(3);

  // Reload: the fan field and its regenerated members reproduce from
  // autosave/JSON round-trip, not just from in-memory React state.
  await page.reload();
  await expect(rafters).toHaveCount(3);

  expect(pageErrors).toEqual([]);
});

test("Fan tool: undo removes an entire fan field (all derived anchors and members) as one action", async ({
  page,
}) => {
  await page.goto("/");
  const rafters = page.locator('[data-testid^="scene-object-fan-field-"]');

  await page.getByRole("button", { name: "Fan", exact: true }).click();
  await page.getByTestId("scene-object-post-1").click();
  await page.getByTestId("scene-object-member-perim-2").click();
  await page.getByRole("button", { name: /commit fan field/i }).click();
  await expect(rafters).toHaveCount(5);

  await page.getByRole("button", { name: /undo/i }).click();
  await expect(rafters).toHaveCount(0);

  await page.getByRole("button", { name: /redo/i }).click();
  await expect(rafters).toHaveCount(5);
});
