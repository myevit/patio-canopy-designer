import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScenePrimitives } from "@canopy/geometry";

vi.mock("./components/ThreeView.js", () => ({
  ThreeView: ({
    scene,
    selectedObjectId,
    onSelect,
  }: {
    scene: ScenePrimitives;
    selectedObjectId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="three-view-canvas">
      {[...scene.posts, ...scene.members, ...scene.joints].map((object) => (
        <button
          key={object.id}
          type="button"
          data-testid={`scene-object-${object.id}`}
          data-selected={object.id === selectedObjectId}
          onClick={() => onSelect(object.id)}
        >
          {object.id}
        </button>
      ))}
    </div>
  ),
}));

const { App } = await import("./App.js");

describe("App", () => {
  it("renders the toolbar, view switcher, inspector, status bar, and drawer", () => {
    render(<App />);
    expect(screen.getByRole("toolbar", { name: "Drawing tools" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/preliminary planning information/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Output drawer")).toBeInTheDocument();
  });

  it("starts in Plan view showing the sample project's posts", () => {
    render(<App />);
    expect(screen.getByTestId("plan-view-svg")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();
  });

  it("selecting a post in Plan view highlights it and updates the inspector", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(screen.getByTestId("scene-object-post-1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("post-1")).toBeInTheDocument();
  });

  it("switching to Split view renders both the plan and 3D views with the same selection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId("scene-object-post-1"));
    await user.click(screen.getByRole("button", { name: "Split" }));
    expect(screen.getByTestId("plan-view-svg")).toBeInTheDocument();
    expect(screen.getByTestId("three-view-canvas")).toBeInTheDocument();
    const planPost = screen.getAllByTestId("scene-object-post-1")[0]!;
    const threePost = screen.getAllByTestId("scene-object-post-1")[1]!;
    expect(planPost).toHaveAttribute("data-selected", "true");
    expect(threePost).toHaveAttribute("data-selected", "true");
  });

  it("selecting the same member id in the 3D view updates the shared selection", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "3D" }));
    await user.click(screen.getByTestId("scene-object-member-ledger"));
    expect(
      within(screen.getByRole("complementary", { name: "Inspector" })).getByText("member-ledger"),
    ).toBeInTheDocument();
  });

  it("pressing Escape returns to the Select tool", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByRole("button", { name: "Post" })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });
});
