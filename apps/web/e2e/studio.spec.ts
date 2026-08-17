import { expect, test } from "@playwright/test";

test("Studio shell: disclaimer, view switching, and synchronized member selection", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("status")).toContainText(/preliminary planning information/i);
  await expect(page.getByTestId("plan-view-svg")).toBeVisible();

  const planMember = page.getByTestId("scene-object-member-fan-a-1");
  await planMember.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("complementary", { name: "Inspector" })).toContainText("member-fan-a-1");

  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByTestId("plan-view-svg")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Inspector" })).toContainText("member-fan-a-1");

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("plan-view-svg")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();

  const threeMember = page.getByRole("button", { name: "Select member-fan-a-1 in 3D scene" });
  await threeMember.focus();
  await page.keyboard.press("Enter");
  await expect(threeMember).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("complementary", { name: "Inspector" })).toContainText("member-fan-a-1");

  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.getByTestId("scene-object-member-fan-a-1")).toHaveAttribute("data-selected", "true");

  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByRole("button", { name: "Post", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute("aria-pressed", "true");

  expect(pageErrors).toEqual([]);
});

test("production build makes no runtime network requests beyond the initial document load", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      externalRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForTimeout(500);

  expect(externalRequests).toEqual([]);
});
