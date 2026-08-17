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

describe("App: posts and beams", () => {
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

  async function placeTwoPosts(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Post" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 2600, clientY: 2400 }); // world (2000, 2000)
    fireEvent.click(svg, { clientX: 5600, clientY: 2400 }); // world (5000, 2000)
    const posts = screen.getAllByTestId(/^scene-object-post-/);
    return { postA: posts.at(-2)!, postB: posts.at(-1)! };
  }

  it("Post tool places a post at the snapped click location, one post per click", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const before = screen.getAllByTestId(/^scene-object-post-/).length;

    await user.click(screen.getByRole("button", { name: "Post" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 2600, clientY: 2400 });

    const after = screen.getAllByTestId(/^scene-object-post-/);
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!).toHaveAttribute("cx", "2000");
    expect(after.at(-1)!).toHaveAttribute("cy", "2000");
  });

  it("places a post entirely via the keyboard-operable coordinate-entry panel in the Inspector", async () => {
    const user = userEvent.setup();
    renderApp();
    const before = screen.getAllByTestId(/^scene-object-post-/).length;

    await user.click(screen.getByRole("button", { name: "Post" }));
    await user.clear(screen.getByLabelText(/^x \(mm\)/i));
    await user.type(screen.getByLabelText(/^x \(mm\)/i), "2000");
    await user.clear(screen.getByLabelText(/^y \(mm\)/i));
    await user.type(screen.getByLabelText(/^y \(mm\)/i), "3000");
    await user.click(screen.getByRole("button", { name: /^add post$/i }));

    const after = screen.getAllByTestId(/^scene-object-post-/);
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!).toHaveAttribute("cx", "2000");
    expect(after.at(-1)!).toHaveAttribute("cy", "3000");
  });

  it("connects two keyboard-placed posts with a beam using only Tab/Enter, no pointer", async () => {
    const user = userEvent.setup();
    renderApp();

    async function placePostViaKeyboard(x: string, y: string) {
      await user.clear(screen.getByLabelText(/^x \(mm\)/i));
      await user.type(screen.getByLabelText(/^x \(mm\)/i), x);
      await user.clear(screen.getByLabelText(/^y \(mm\)/i));
      await user.type(screen.getByLabelText(/^y \(mm\)/i), y);
      await user.click(screen.getByRole("button", { name: /^add post$/i }));
    }

    await user.click(screen.getByRole("button", { name: "Post" }));
    await placePostViaKeyboard("2000", "2000");
    await placePostViaKeyboard("5000", "2000");
    const posts = screen.getAllByTestId(/^scene-object-post-/);
    const postA = posts.at(-2)!;
    const postB = posts.at(-1)!;
    const beamsBefore = screen.getAllByTestId(/^scene-object-member-/).length;

    await user.click(screen.getByRole("button", { name: "Beam" }));
    postA.focus();
    await user.keyboard("{Enter}");
    postB.focus();
    await user.keyboard("{Enter}");

    const beams = screen.getAllByTestId(/^scene-object-member-/);
    expect(beams.length).toBe(beamsBefore + 1);
    const newBeam = beams.at(-1)!;
    expect(newBeam).toHaveAttribute("x1", "2000");
    expect(newBeam).toHaveAttribute("y1", "2000");
    expect(newBeam).toHaveAttribute("x2", "5000");
    expect(newBeam).toHaveAttribute("y2", "2000");
  });

  it("Beam tool: choosing a start post then an end post commits a beam between their top anchors", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postA, postB } = await placeTwoPosts(user);
    const beamsBefore = screen.getAllByTestId(/^scene-object-member-/).length;

    await user.click(screen.getByRole("button", { name: "Beam" }));
    fireEvent.click(postA);
    fireEvent.click(postB);

    const beams = screen.getAllByTestId(/^scene-object-member-/);
    expect(beams.length).toBe(beamsBefore + 1);
    const newBeam = beams.at(-1)!;
    expect(newBeam).toHaveAttribute("x1", "2000");
    expect(newBeam).toHaveAttribute("y1", "2000");
    expect(newBeam).toHaveAttribute("x2", "5000");
    expect(newBeam).toHaveAttribute("y2", "2000");
  });

  it("moving a post updates the connected beam's endpoint (reference-aware movement)", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postA, postB } = await placeTwoPosts(user);
    await user.click(screen.getByRole("button", { name: "Beam" }));
    fireEvent.click(postA);
    fireEvent.click(postB);
    const beam = screen.getAllByTestId(/^scene-object-member-/).at(-1)!;

    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(postA);
    const xField = screen.getByLabelText(/base x/i);
    fireEvent.change(xField, { target: { value: "2500" } });
    fireEvent.blur(xField);

    expect(postA).toHaveAttribute("cx", "2500");
    expect(beam).toHaveAttribute("x1", "2500");
  });

  it("deleting a post cascades to delete a beam connected to it, leaving no dangling reference", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postA, postB } = await placeTwoPosts(user);
    await user.click(screen.getByRole("button", { name: "Beam" }));
    fireEvent.click(postA);
    fireEvent.click(postB);
    const beamsWithConnection = screen.getAllByTestId(/^scene-object-member-/).length;

    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(postA);
    await user.click(screen.getByRole("button", { name: /delete post/i }));

    expect(screen.queryByTestId(postA.getAttribute("data-testid")!)).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^scene-object-member-/).length).toBe(beamsWithConnection - 1);
  });

  it("deletes the selected post via the Delete key", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Post" }));
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 2600, clientY: 2400 });
    await user.click(screen.getByRole("button", { name: "Select" }));
    const post = screen.getAllByTestId(/^scene-object-post-/).at(-1)!;
    const testId = post.getAttribute("data-testid")!;
    fireEvent.click(post);

    fireEvent.keyDown(window, { key: "Delete" });

    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it("deletes the selected beam via the Inspector", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postA, postB } = await placeTwoPosts(user);
    await user.click(screen.getByRole("button", { name: "Beam" }));
    fireEvent.click(postA);
    fireEvent.click(postB);
    const beam = screen.getAllByTestId(/^scene-object-member-/).at(-1)!;
    const beamTestId = beam.getAttribute("data-testid")!;

    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(beam);
    await user.click(screen.getByRole("button", { name: /delete beam/i }));

    expect(screen.queryByTestId(beamTestId)).not.toBeInTheDocument();
  });

  it("blocks deleting a joint that connects a fan field rafter, surfacing a friendly status message", async () => {
    const user = userEvent.setup();
    renderApp();
    const joint = screen.getByTestId("scene-object-joint-crossing-1");
    await user.click(joint);
    await user.click(screen.getByRole("button", { name: /delete joint/i }));

    expect(screen.getByTestId("scene-object-joint-crossing-1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/fan field/i);
  });
});

describe("App: intersections and joints", () => {
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

  async function drawCrossingFrame(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Post" }));
    const svg = screen.getByTestId("plan-view-svg");
    // Horizontal beam's posts: world (2000, 2000) and (5000, 2000).
    fireEvent.click(svg, { clientX: 2600, clientY: 2400 });
    fireEvent.click(svg, { clientX: 5600, clientY: 2400 });
    // Vertical beam's posts: world (3500, 500) and (3500, 3500).
    fireEvent.click(svg, { clientX: 4100, clientY: 900 });
    fireEvent.click(svg, { clientX: 4100, clientY: 3900 });
    const posts = screen.getAllByTestId(/^scene-object-post-/);
    const [postA, postB, postC, postD] = posts.slice(-4);

    await user.click(screen.getByRole("button", { name: "Beam" }));
    fireEvent.click(postA!);
    fireEvent.click(postB!);
    fireEvent.click(postC!);
    fireEvent.click(postD!);

    await user.click(screen.getByRole("button", { name: "Select" }));
    return { postA: postA!, postB: postB!, postC: postC! };
  }

  it("detects a crossing between two beams, confirms it as a structural joint, and inspects it in 3D focus mode", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    await drawCrossingFrame(user);

    await user.click(screen.getByRole("button", { name: "Joint" }));
    expect(screen.getByText(/detected connections/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /review/i }).at(-1)!);

    expect(screen.getByText(/confirm connection/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create joint/i }));

    const inspector = screen.getByRole("complementary", { name: "Inspector" });
    expect(within(inspector).getByText(/^joint$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/crossing behavior/i)).toHaveValue("structural-joint");

    await user.click(screen.getByRole("button", { name: /inspect in 3d/i }));
    expect(screen.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
  });

  it("regenerates a confirmed joint's position when a connected post moves, within tolerance", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postC } = await drawCrossingFrame(user);

    await user.click(screen.getByRole("button", { name: "Joint" }));
    await user.click(screen.getAllByRole("button", { name: /review/i }).at(-1)!);
    await user.click(screen.getByRole("button", { name: /create joint/i }));
    const positionBefore = screen.getByLabelText(/position x/i).getAttribute("value");

    // postC anchors the vertical beam at x=3500; nudging it to x=3600 shifts
    // where it crosses the horizontal beam without breaking the crossing.
    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(postC);
    const xField = screen.getByLabelText(/base x/i);
    fireEvent.change(xField, { target: { value: "3600" } });
    fireEvent.blur(xField);

    const joint = screen.getAllByTestId(/^scene-object-joint-/).at(-1)!;
    fireEvent.click(joint);
    expect(screen.getByLabelText(/position x/i).getAttribute("value")).not.toBe(positionBefore);
    expect(screen.getByLabelText(/crossing behavior/i)).toHaveValue("structural-joint");
  });

  it("flags a confirmed joint as unresolved once a move breaks the crossing entirely", async () => {
    mockRect();
    const user = userEvent.setup();
    renderApp();
    const { postC } = await drawCrossingFrame(user);

    await user.click(screen.getByRole("button", { name: "Joint" }));
    await user.click(screen.getAllByRole("button", { name: /review/i }).at(-1)!);
    await user.click(screen.getByRole("button", { name: /create joint/i }));

    // Moving postC's beam far outside the horizontal beam's x-range removes the crossing entirely.
    await user.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(postC);
    const xField = screen.getByLabelText(/base x/i);
    fireEvent.change(xField, { target: { value: "9000" } });
    fireEvent.blur(xField);

    const joint = screen.getAllByTestId(/^scene-object-joint-/).at(-1)!;
    fireEvent.click(joint);
    expect(screen.getByLabelText(/crossing behavior/i)).toHaveValue("unresolved");
  });
});

describe("App: fan fields", () => {
  it("Fan tool: choosing a source anchor then a target member previews and commits a fan field", async () => {
    const user = userEvent.setup();
    renderApp();
    const membersBefore = screen.getAllByTestId(/^scene-object-(member-|fan-field-)/).length;

    await user.click(screen.getByRole("button", { name: "Fan" }));
    expect(screen.getByRole("status")).toHaveTextContent(/fan source anchor/i);
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(screen.getByRole("status")).toHaveTextContent(/fan target/i);
    await user.click(screen.getByTestId("scene-object-member-perim-2"));

    expect(screen.getByRole("button", { name: /commit fan field/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /commit fan field/i }));

    const membersAfter = screen.getAllByTestId(/^scene-object-(member-|fan-field-)/);
    expect(membersAfter.length).toBe(membersBefore + 5);
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cancelling a fan preview discards the draft without creating any members", async () => {
    const user = userEvent.setup();
    renderApp();
    const membersBefore = screen.getAllByTestId(/^scene-object-(member-|fan-field-)/).length;

    await user.click(screen.getByRole("button", { name: "Fan" }));
    await user.click(screen.getByTestId("scene-object-post-1"));
    await user.click(screen.getByTestId("scene-object-member-perim-2"));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.getAllByTestId(/^scene-object-(member-|fan-field-)/).length).toBe(membersBefore);
    expect(screen.getByRole("status")).toHaveTextContent(/fan source anchor/i);
  });

  it("selecting a derived rafter shows the parent fan field's editable count, and changing it regenerates members", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Fan" }));
    await user.click(screen.getByTestId("scene-object-post-1"));
    await user.click(screen.getByTestId("scene-object-member-perim-2"));
    await user.click(screen.getByRole("button", { name: /commit fan field/i }));

    const newRafter = screen
      .getAllByTestId(/^scene-object-(member-|fan-field-)/)
      .find((el) => el.getAttribute("data-testid")!.includes("::rafter::0"))!;
    fireEvent.click(newRafter);

    const countField = screen.getByLabelText(/^count$/i);
    expect(countField).toHaveValue(5);
    fireEvent.change(countField, { target: { value: "3" } });
    fireEvent.blur(countField);

    const fanFieldId = newRafter.getAttribute("data-testid")!.replace("scene-object-", "").split("::rafter::")[0]!;
    expect(screen.getAllByTestId(new RegExp(`^scene-object-${fanFieldId}::rafter::`)).length).toBe(3);
  });

  it("deletes a fan field via the Inspector, removing all of its derived members", async () => {
    const user = userEvent.setup();
    renderApp();
    const membersBefore = screen.getAllByTestId(/^scene-object-(member-|fan-field-)/).length;

    await user.click(screen.getByRole("button", { name: "Fan" }));
    await user.click(screen.getByTestId("scene-object-post-1"));
    await user.click(screen.getByTestId("scene-object-member-perim-2"));
    await user.click(screen.getByRole("button", { name: /commit fan field/i }));

    const newRafter = screen
      .getAllByTestId(/^scene-object-(member-|fan-field-)/)
      .find((el) => el.getAttribute("data-testid")!.includes("::rafter::0"))!;
    fireEvent.click(newRafter);
    await user.click(screen.getByRole("button", { name: /delete fan field/i }));

    expect(screen.getAllByTestId(/^scene-object-(member-|fan-field-)/).length).toBe(membersBefore);
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
