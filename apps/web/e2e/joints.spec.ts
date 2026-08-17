import { expect, test } from "@playwright/test";

test("detect a crossing, confirm it as a joint, inspect it in plan/3D and 3D focus mode, then move geometry to regenerate or flag it", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();

  const posts = page.locator('[data-testid^="scene-object-post-"]');
  const beams = page.locator('[data-testid^="scene-object-member-"]');
  const joints = page.locator('[data-testid^="scene-object-joint-"]');

  // Place four posts: two for a horizontal beam, two for a vertical beam that
  // crosses it, so the frame has exactly one interior crossing to detect.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const svg = page.getByTestId("plan-view-svg");
  const box = (await svg.boundingBox())!;
  async function clickWorld(x: number, y: number) {
    const fracX = (x + 600) / 8400;
    const fracY = (y + 400) / 5200;
    await svg.click({ position: { x: box.width * fracX, y: box.height * fracY } });
  }
  await clickWorld(2000, 2000); // post A
  await clickWorld(5000, 2000); // post B
  await clickWorld(3500, 500); // post C
  await clickWorld(3500, 3500); // post D
  await expect(posts).toHaveCount(4);

  // Draw the frame: horizontal beam A-B, vertical beam C-D. They cross at (3500, 2000).
  await page.getByRole("button", { name: "Beam", exact: true }).click();
  await posts.nth(0).click();
  await posts.nth(1).click();
  await expect(beams).toHaveCount(1);
  await posts.nth(2).click();
  await posts.nth(3).click();
  await expect(beams).toHaveCount(2);

  // Before the crossing is confirmed, it's an unresolved topology issue that
  // blocks Export: the diagnostics panel surfaces it, and Export is disabled.
  const exportButton = page.getByRole("button", { name: "Export", exact: true });
  const diagnostics = page.getByRole("region", { name: "Topology diagnostics" });
  await expect(diagnostics).toContainText(/topology issue/i);
  await expect(exportButton).toBeDisabled();

  // Auto-detect the crossing via the Joint tool and confirm it as a structural joint.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Joint", exact: true }).click();
  await expect(page.getByText(/detected connections/i)).toBeVisible();
  await page.getByRole("button", { name: /review/i }).click();
  await expect(page.getByText(/confirm connection/i)).toBeVisible();
  await page.getByRole("button", { name: /create joint/i }).click();
  await expect(joints).toHaveCount(1);

  // Confirming the joint resolves the only outstanding topology issue, so
  // Export becomes available again.
  await expect(diagnostics).toContainText(/no topology issues/i);
  await expect(exportButton).toBeEnabled();

  // Selecting the joint highlights its connected members in-view in Plan,
  // not only via the separate "Inspect in 3D" isolation mode.
  await expect(beams.nth(0)).toHaveAttribute("data-connected", "true");
  await expect(beams.nth(1)).toHaveAttribute("data-connected", "true");

  // Inspect the confirmed joint in Plan view via the Inspector.
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.getByText(/^joint$/i)).toBeVisible();
  await expect(page.getByLabel(/crossing behavior/i)).toHaveValue("structural-joint");

  // Inspect the same joint in the 3D view, via the same canonical id: the sr-only
  // accessible object list is how a real browser (with a WebGL canvas that has no
  // per-mesh DOM nodes) can drive/inspect 3D selection in this app.
  const jointTestId = (await joints.first().getAttribute("data-testid"))!;
  const jointId = jointTestId.replace("scene-object-", "");
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  const threeJointButton = page.getByRole("button", { name: `Select ${jointId} in 3D scene` });
  await expect(threeJointButton).toBeVisible();

  // Enter the focused/local 3D inspection mode: only the joint and its
  // connected members remain in the 3D scene's accessible object list.
  await page.getByRole("button", { name: /inspect in 3d/i }).click();
  await expect(page.getByRole("button", { name: "3D", exact: true })).toHaveAttribute("aria-pressed", "true");
  const threeSceneObjects = page.getByRole("group", { name: "3D scene objects" }).getByRole("button");
  await expect(threeSceneObjects).toHaveCount(3); // the joint + its two connected members

  // An explicit "Exit focus" button clears focus mode without relying on Escape.
  await page.getByRole("button", { name: /exit focus/i }).click();
  await expect(page.getByRole("button", { name: /exit focus/i })).toHaveCount(0);
  await expect(threeSceneObjects).toHaveCount(7); // 4 posts + 2 beams + 1 joint, back to the full scene

  // Move connected geometry: nudging post C shifts the crossing point, so the
  // confirmed joint regenerates in place rather than needing resolution.
  // Switch back to Plan/Split first so the Plan view's real DOM elements
  // (rather than the WebGL-only 3D scene) are available to click.
  await page.getByRole("button", { name: "Split" }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await posts.nth(2).click();
  const xField = page.getByLabel(/base x/i);
  await xField.fill("3600");
  await xField.blur();

  await joints.first().click();
  const positionXField = page.getByLabel(/position x/i);
  await expect(positionXField).not.toHaveValue("3500");
  await expect(page.getByLabel(/crossing behavior/i)).toHaveValue("structural-joint");

  // Moving post C far enough that the beams no longer cross flags the joint
  // as needing resolution instead of leaving it silently stale.
  await posts.nth(2).click();
  await xField.fill("9000");
  await xField.blur();

  await joints.first().click();
  await expect(page.getByLabel(/crossing behavior/i)).toHaveValue("unresolved");

  // The stale joint is a topology issue again, so Export is blocked until it's resolved.
  await expect(diagnostics).toContainText(/topology issue/i);
  await expect(exportButton).toBeDisabled();

  expect(pageErrors).toEqual([]);
});
