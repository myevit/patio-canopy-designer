import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScenePrimitives } from "@canopy/geometry";
import type { ProjectDocument } from "@canopy/shared";
import { exportProjectDocument } from "@canopy/shared";
import type { PersistenceAdapter } from "./persistence/persistence-adapter.js";

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

function createFakeAdapter(initial?: ProjectDocument): PersistenceAdapter {
  let stored = initial;
  return {
    async load() {
      return stored;
    },
    async save(document) {
      stored = document;
    },
    async clear() {
      stored = undefined;
    },
  };
}

function renderApp() {
  return render(<App persistenceAdapter={createFakeAdapter()} />);
}

describe("App", () => {
  it("renders the toolbar, view switcher, inspector, status bar, and drawer", () => {
    renderApp();
    expect(screen.getByRole("toolbar", { name: "Drawing tools" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/preliminary planning information/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Output drawer")).toBeInTheDocument();
  });

  it("starts in Plan view showing the sample project's posts", () => {
    renderApp();
    expect(screen.getByTestId("plan-view-svg")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();
  });

  it("selecting a post in Plan view highlights it and updates the inspector", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(screen.getByTestId("scene-object-post-1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("post-1")).toBeInTheDocument();
  });

  it("switching to Split view renders both the plan and 3D views with the same selection", async () => {
    const user = userEvent.setup();
    renderApp();
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
    renderApp();
    await user.click(screen.getByRole("button", { name: "3D" }));
    await user.click(screen.getByTestId("scene-object-member-ledger"));
    expect(
      within(screen.getByRole("complementary", { name: "Inspector" })).getByText("member-ledger"),
    ).toBeInTheDocument();
  });

  it("pressing Escape returns to the Select tool", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByRole("button", { name: "Post" })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("App: keyboard shortcuts", () => {
  it("Backspace pressed while a numeric field is focused does not delete the selected vertex", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("house-vertex-house-outline-1-0"));
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "-999" } });
    // Backspace dispatched with the numeric field itself as the event target
    // must be ignored by the global shortcut handler.
    fireEvent.keyDown(xField, { key: "Backspace" });
    expect(screen.getByTestId("house-vertex-house-outline-1-0")).toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-1")).toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-2")).toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-3")).toBeInTheDocument();
  });

  it("moving a vertex then deleting it via Backspace (outside any input) uses the latest document, not a stale one", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("house-vertex-house-outline-1-0"));
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "-999" } });
    fireEvent.blur(xField);

    // Delete the (still-selected) moved vertex via a global Backspace whose
    // event target is not an editable element.
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(screen.queryByTestId("house-vertex-house-outline-1-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-0")).toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-1")).toBeInTheDocument();
    expect(screen.getByTestId("house-vertex-house-outline-1-2")).toBeInTheDocument();

    // Undo the delete: a correct (non-stale) dispatch restores the moved
    // document, so vertex 0 reappears at its moved x, not its original x.
    await user.click(screen.getByRole("button", { name: /undo/i }));
    fireEvent.click(screen.getByTestId("house-vertex-house-outline-1-0"));
    expect(screen.getByLabelText(/vertex x/i)).toHaveValue(-999);
  });
});

describe("App: house outline authoring", () => {
  function mockRect() {
    const rect = { left: 0, top: 0, width: 8400, height: 5200 };
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.width,
      bottom: rect.height,
      x: 0,
      y: 0,
      toJSON: () => rect,
    } as DOMRect);
  }

  it("draws a closed house outline entirely via the keyboard-operable coordinate-entry panel", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "House" }));
    const before = screen.getAllByLabelText(/^House outline/).length;

    async function addPoint(x: string, y: string) {
      await user.clear(screen.getByLabelText(/^x \(mm\)/i));
      await user.type(screen.getByLabelText(/^x \(mm\)/i), x);
      await user.clear(screen.getByLabelText(/^y \(mm\)/i));
      await user.type(screen.getByLabelText(/^y \(mm\)/i), y);
      await user.click(screen.getByRole("button", { name: /^add point$/i }));
    }

    await addPoint("0", "0");
    await addPoint("4000", "0");
    await addPoint("4000", "3000");

    const closeButton = screen.getByRole("button", { name: /close outline/i });
    expect(closeButton).toBeEnabled();
    await user.click(closeButton);

    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByLabelText(/^House outline/).length).toBe(before + 1);
  });

  it("draws a closed house outline and adds a roof plane to it", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "House" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 600, clientY: 400 });
    fireEvent.click(svg, { clientX: 1600, clientY: 400 });
    fireEvent.click(svg, { clientX: 1600, clientY: 1400 });

    const closeAffordance = screen.getByTestId("house-outline-close-affordance");
    fireEvent.click(closeAffordance);

    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
    const outlines = screen.getAllByLabelText(/^House outline/);
    expect(outlines.length).toBeGreaterThanOrEqual(1);

    const newOutline = outlines.at(-1)!;
    fireEvent.click(newOutline);
    await user.click(screen.getByRole("button", { name: /add roof plane/i }));

    expect(screen.getByLabelText(/reference elevation/i)).toBeInTheDocument();
  });

  it("rejects a zero-area outline with a recoverable message and keeps the in-progress points", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "House" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 600, clientY: 400 });
    fireEvent.click(svg, { clientX: 1600, clientY: 400 });
    fireEvent.click(svg, { clientX: 2600, clientY: 400 });

    fireEvent.click(screen.getByTestId("house-outline-close-affordance"));

    expect(screen.getByRole("status")).toHaveTextContent(/zero area/i);
    expect(screen.getByTestId("house-drawing-point-1")).toBeInTheDocument();
  });
});

describe("App: undo/redo and project menu", () => {
  function mockRect() {
    const rect = { left: 0, top: 0, width: 8400, height: 5200 };
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.width,
      bottom: rect.height,
      x: 0,
      y: 0,
      toJSON: () => rect,
    } as DOMRect);
  }

  it("undoes and redoes a completed house outline", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const before = screen.getAllByLabelText(/^House outline/).length;

    await user.click(screen.getByRole("button", { name: "House" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 600, clientY: 400 });
    fireEvent.click(svg, { clientX: 1600, clientY: 400 });
    fireEvent.click(svg, { clientX: 1600, clientY: 1400 });
    fireEvent.click(screen.getByTestId("house-outline-close-affordance"));

    expect(screen.getAllByLabelText(/^House outline/).length).toBe(before + 1);
    expect(screen.getByRole("button", { name: /undo/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(screen.getAllByLabelText(/^House outline/).length).toBe(before);

    await user.click(screen.getByRole("button", { name: /redo/i }));
    expect(screen.getAllByLabelText(/^House outline/).length).toBe(before + 1);
  });

  it("New clears the project back to an empty document", async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.queryByTestId("scene-object-post-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
  });

  it("Export triggers a JSON download of the current project", async () => {
    const user = userEvent.setup();
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderApp();
    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("Import replaces the current project with the uploaded document", async () => {
    renderApp();
    const { createEmptyProjectDocument } = await import("@canopy/shared");
    const imported = exportProjectDocument(
      createEmptyProjectDocument({ name: "Imported project", createdAt: "2026-08-16T00:00:00.000Z" }),
    );
    const file = new File([imported], "project.json", { type: "application/json" });
    const input = screen.getByLabelText(/import/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText(/no selection/i);
    expect(screen.queryByTestId("scene-object-post-1")).not.toBeInTheDocument();
  });
});
