import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScenePrimitives } from "@canopy/geometry";
import { PlanView } from "./PlanView.js";

function scene(): ScenePrimitives {
  return {
    houseOutlines: [
      {
        id: "house-1",
        kind: "house-outline",
        points: [
          { x: 0, y: -300, z: 0 },
          { x: 100, y: -300, z: 0 },
          { x: 100, y: 0, z: 0 },
        ],
      },
    ],
    roofPlanes: [],
    gutters: [],
    walls: [],
    patioOutlines: [
      {
        id: "patio-1",
        kind: "patio-outline",
        points: [
          { x: 0, y: 100, z: 0 },
          { x: 200, y: 100, z: 0 },
          { x: 200, y: 300, z: 0 },
        ],
      },
    ],
    posts: [
      {
        id: "post-1",
        kind: "post",
        base: { x: 50, y: 400, z: 0 },
        top: { x: 50, y: 400, z: 2400 },
        baseAnchorId: "anchor-base",
        topAnchorId: "anchor-top",
        sectionId: "sec-post",
        widthMm: 140,
        depthMm: 140,
      },
    ],
    members: [
      {
        id: "member-1",
        kind: "member",
        role: "fan-rafter",
        start: { x: 0, y: 0, z: 2700 },
        end: { x: 50, y: 400, z: 2400 },
        sectionId: "sec-beam",
        widthMm: 89,
        heightMm: 38,
        rollRad: 0,
      },
    ],
    joints: [
      { id: "joint-1", kind: "joint", position: { x: 25, y: 200, z: 2500 }, connectedMemberIds: ["member-1"] },
    ],
    houseAnchors: [
      { id: "anchor-house-1", kind: "house-anchor", position: { x: 3000, y: -300, z: 2700 } },
    ],
  };
}

describe("PlanView", () => {
  it("renders an interactive plan group containing the house outline, patio outline, post, member, and joint", () => {
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByRole("group", { name: "Plan view" })).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-member-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-joint-1")).toBeInTheDocument();
    expect(screen.getByTestId("house-outline-house-1")).toBeInTheDocument();
    expect(screen.getByTestId("patio-outline-patio-1")).toBeInTheDocument();
  });

  it("calls onSelect with the post id when the post is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(onSelect).toHaveBeenCalledWith("post-1");
  });

  it("calls onSelect with the member id when the member is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    await user.click(screen.getByTestId("scene-object-member-1"));
    expect(onSelect).toHaveBeenCalledWith("member-1");
  });

  it("selects a focused member when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    const member = screen.getByTestId("scene-object-member-1");

    member.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("member-1");
  });

  it("selects a focused post when Space is pressed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    const post = screen.getByTestId("scene-object-post-1");

    post.focus();
    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledWith("post-1");
  });

  it("marks the selected object distinctly", () => {
    render(<PlanView scene={scene()} selectedObjectId="post-1" onSelect={() => {}} />);
    expect(screen.getByTestId("scene-object-post-1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("scene-object-member-1")).toHaveAttribute("data-selected", "false");
  });

  it("selects a house outline when its body is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    await user.click(screen.getByTestId("house-outline-house-1"));
    expect(onSelect).toHaveBeenCalledWith("house-1");
  });
});

describe("PlanView house drawing", () => {
  function mockRect() {
    const rect = { left: 0, top: 0, width: 8400, height: 5200 };
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.width,
      bottom: rect.height,
      x: 0,
      y: 0,
      toJSON: () => rect,
    });
  }

  it("adds a drawing point at the clicked world position when the house tool is active", async () => {
    mockRect();
    const onAddDrawingPoint = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="house"
        drawingPoints={[]}
        onAddDrawingPoint={onAddDrawingPoint}
      />,
    );
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 600, clientY: 400 });
    expect(onAddDrawingPoint).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 });
  });

  it("does not add a drawing point when clicking an existing scene object", async () => {
    mockRect();
    const onAddDrawingPoint = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="house"
        drawingPoints={[]}
        onAddDrawingPoint={onAddDrawingPoint}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-object-post-1"), { clientX: 650, clientY: 1000 });
    expect(onAddDrawingPoint).not.toHaveBeenCalled();
  });

  it("renders a close affordance once at least three points are drawn, and closes on click", () => {
    mockRect();
    const onCloseDrawing = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="house"
        drawingPoints={[
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
          { x: 1000, y: 1000, z: 0 },
        ]}
        onCloseDrawing={onCloseDrawing}
      />,
    );
    const closeAffordance = screen.getByTestId("house-outline-close-affordance");
    fireEvent.click(closeAffordance, { clientX: 600, clientY: 400 });
    expect(onCloseDrawing).toHaveBeenCalled();
  });

  it("does not render a close affordance with fewer than three points", () => {
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="house"
        drawingPoints={[{ x: 0, y: 0, z: 0 }]}
      />,
    );
    expect(screen.queryByTestId("house-outline-close-affordance")).not.toBeInTheDocument();
  });
});

describe("PlanView vertex editing", () => {
  function mockRect() {
    const rect = { left: 0, top: 0, width: 8400, height: 5200 };
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.width,
      bottom: rect.height,
      x: 0,
      y: 0,
      toJSON: () => rect,
    });
  }

  it("renders a vertex marker per house outline point and selects it on click", async () => {
    mockRect();
    const onSelectVertex = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        onSelectVertex={onSelectVertex}
      />,
    );
    const vertex = screen.getByTestId("house-vertex-house-1-0");
    fireEvent.click(vertex, { clientX: 600, clientY: 400 });
    expect(onSelectVertex).toHaveBeenCalledWith({ outlineId: "house-1", index: 0 });
  });

  it("drags a vertex and commits the move on pointer up", () => {
    mockRect();
    const onMoveVertex = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        onMoveVertex={onMoveVertex}
      />,
    );
    const vertex = screen.getByTestId("house-vertex-house-1-0");
    fireEvent.pointerDown(vertex, { clientX: 600, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(vertex, { clientX: 700, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(vertex, { clientX: 700, clientY: 500, pointerId: 1 });
    expect(onMoveVertex).toHaveBeenCalledWith({ outlineId: "house-1", index: 0 }, { x: 100, y: 100, z: 0 });
  });

  it("renders a midpoint marker for each edge of the selected outline and inserts a vertex on click", () => {
    mockRect();
    const onInsertVertex = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId="house-1"
        onSelect={() => {}}
        onInsertVertex={onInsertVertex}
      />,
    );
    const midpoint = screen.getByTestId("house-midpoint-house-1-0");
    fireEvent.click(midpoint, { clientX: 600, clientY: 400 });
    expect(onInsertVertex).toHaveBeenCalledWith("house-1", 0, { x: 50, y: -300, z: 0 });
  });

  it("does not render midpoint markers when the outline is not selected", () => {
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.queryByTestId("house-midpoint-house-1-0")).not.toBeInTheDocument();
  });
});

describe("PlanView post placement", () => {
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

  it("shows a snapped placement preview that follows the cursor when the post tool is active", () => {
    mockRect();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} tool="post" />);
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.pointerMove(svg, { clientX: 5640, clientY: 4470 });
    const preview = screen.getByTestId("post-placement-preview");
    expect(preview).toHaveAttribute("cx", "5000");
    expect(preview).toHaveAttribute("cy", "4100");
  });

  it("does not show a placement preview outside the post tool", () => {
    mockRect();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} tool="select" />);
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.pointerMove(svg, { clientX: 5640, clientY: 4470 });
    expect(screen.queryByTestId("post-placement-preview")).not.toBeInTheDocument();
  });

  it("places a post at the snapped position on click", () => {
    mockRect();
    const onPlacePost = vi.fn();
    render(
      <PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} tool="post" onPlacePost={onPlacePost} />,
    );
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 5640, clientY: 4470 });
    expect(onPlacePost).toHaveBeenCalledWith({ x: 5000, y: 4100, z: 0 });
  });

  it("bypasses snapping for free placement while Shift is held", () => {
    mockRect();
    const onPlacePost = vi.fn();
    render(
      <PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} tool="post" onPlacePost={onPlacePost} />,
    );
    const svg = screen.getByTestId("plan-view-svg");
    fireEvent.click(svg, { clientX: 5637, clientY: 4463, shiftKey: true });
    expect(onPlacePost).toHaveBeenCalledWith({ x: 5037, y: 4063, z: 0 });
  });
});

describe("PlanView post dragging", () => {
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

  it("drags a post and commits the move on pointer up while the Select tool is active", () => {
    mockRect();
    const onMovePost = vi.fn();
    render(
      <PlanView scene={scene()} selectedObjectId={null} onSelect={() => {}} tool="select" onMovePost={onMovePost} />,
    );
    const post = screen.getByTestId("scene-object-post-1");
    fireEvent.pointerDown(post, { clientX: 600, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(post, { clientX: 700, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(post, { clientX: 700, clientY: 500, pointerId: 1 });
    expect(onMovePost).toHaveBeenCalledWith("post-1", { x: 100, y: 100, z: 0 });
  });

  it("does not drag a post while the Beam tool is active, so clicks can choose it as an anchor instead", () => {
    mockRect();
    const onMovePost = vi.fn();
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onMovePost={onMovePost}
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    const post = screen.getByTestId("scene-object-post-1");
    fireEvent.pointerDown(post, { clientX: 600, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(post, { clientX: 700, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(post, { clientX: 700, clientY: 500, pointerId: 1 });
    expect(onMovePost).not.toHaveBeenCalled();
  });
});

describe("PlanView beam flow", () => {
  it("clicking a post while the Beam tool is active chooses its top anchor instead of selecting it", () => {
    const onSelect = vi.fn();
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-object-post-1"));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-top");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a house anchor while the Beam tool is active chooses it", () => {
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    fireEvent.click(screen.getByTestId("scene-object-anchor-house-1"));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-house-1");
  });

  it("selects a focused post's top anchor via Enter when the Beam tool is active, instead of selecting it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    const post = screen.getByTestId("scene-object-post-1");
    post.focus();
    await user.keyboard("{Enter}");
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-top");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects a focused post's top anchor via Space when the Beam tool is active", async () => {
    const user = userEvent.setup();
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    const post = screen.getByTestId("scene-object-post-1");
    post.focus();
    await user.keyboard(" ");
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-top");
  });

  it("still selects a focused post via Enter outside the Beam tool", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={scene()} selectedObjectId={null} onSelect={onSelect} tool="select" />);
    const post = screen.getByTestId("scene-object-post-1");
    post.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("post-1");
  });

  it("selects a focused house anchor via Enter when the Beam tool is active", async () => {
    const user = userEvent.setup();
    const onChooseBeamAnchor = vi.fn();
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    const anchor = screen.getByTestId("scene-object-anchor-house-1");
    anchor.focus();
    await user.keyboard("{Enter}");
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-house-1");
  });

  it("renders a valid preview beam line when hovering a different candidate anchor", () => {
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        beamStartAnchorId="anchor-top"
      />,
    );
    fireEvent.pointerEnter(screen.getByTestId("scene-object-anchor-house-1"));
    const preview = screen.getByTestId("beam-preview");
    expect(preview).toHaveAttribute("data-valid", "true");
  });

  it("renders an invalid preview beam line when hovering the same anchor chosen as the start", () => {
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        beamStartAnchorId="anchor-top"
      />,
    );
    fireEvent.pointerEnter(screen.getByTestId("scene-object-post-1"));
    const preview = screen.getByTestId("beam-preview");
    expect(preview).toHaveAttribute("data-valid", "false");
  });

  it("clears the preview beam line on pointer leave", () => {
    render(
      <PlanView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        beamStartAnchorId="anchor-top"
      />,
    );
    const target = screen.getByTestId("scene-object-anchor-house-1");
    fireEvent.pointerEnter(target);
    expect(screen.getByTestId("beam-preview")).toBeInTheDocument();
    fireEvent.pointerLeave(target);
    expect(screen.queryByTestId("beam-preview")).not.toBeInTheDocument();
  });
});

describe("PlanView roof and gutter rendering", () => {
  function sceneWithRoofOverHouse(): ScenePrimitives {
    const base = scene();
    return {
      ...base,
      roofPlanes: [
        {
          id: "roof-1",
          kind: "roof-plane",
          houseOutlineId: "house-1",
          referenceElevationMm: 2700,
          pitchRad: 0.1,
          directionRad: 0,
          outline: base.houseOutlines[0]!.points,
        },
      ],
      gutters: [
        {
          id: "gutter-1",
          kind: "gutter",
          roofPlaneId: "roof-1",
          start: { x: 0, y: -300, z: 2700 },
          end: { x: 100, y: -300, z: 2700 },
          widthMm: 100,
          dropMm: 50,
        },
      ],
    };
  }

  it("renders a gutter line for each scene gutter", () => {
    render(<PlanView scene={sceneWithRoofOverHouse()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("gutter-gutter-1")).toBeInTheDocument();
  });

  it("still selects the house outline underneath when the roof polygon fully covers it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanView scene={sceneWithRoofOverHouse()} selectedObjectId={null} onSelect={onSelect} />);
    await user.click(screen.getByTestId("house-outline-house-1"));
    expect(onSelect).toHaveBeenCalledWith("house-1");
  });

  it("gives the roof polygon no pointer events so it never intercepts clicks", () => {
    render(<PlanView scene={sceneWithRoofOverHouse()} selectedObjectId={null} onSelect={() => {}} />);
    const roof = screen.getByTestId("roof-plane-roof-1");
    expect(roof).toHaveStyle({ pointerEvents: "none" });
  });

  it("clicking a gutter while the Beam tool is active creates a house anchor projected onto it", () => {
    const rect = { left: 0, top: 0, width: 8400, height: 5200 };
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...rect,
      right: rect.width,
      bottom: rect.height,
      x: 0,
      y: 0,
      toJSON: () => rect,
    } as DOMRect);
    const onCreateHouseAnchorOnGutter = vi.fn();
    render(
      <PlanView
        scene={sceneWithRoofOverHouse()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onCreateHouseAnchorOnGutter={onCreateHouseAnchorOnGutter}
      />,
    );
    fireEvent.click(screen.getByTestId("gutter-gutter-1"), { clientX: 650, clientY: 350 });
    expect(onCreateHouseAnchorOnGutter).toHaveBeenCalledWith("gutter-1", { x: 50, y: -300, z: 2700 });
  });

  it("is keyboard focusable while the Beam tool is active, and Enter projects a house anchor onto its midpoint", async () => {
    const user = userEvent.setup();
    const onCreateHouseAnchorOnGutter = vi.fn();
    render(
      <PlanView
        scene={sceneWithRoofOverHouse()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onCreateHouseAnchorOnGutter={onCreateHouseAnchorOnGutter}
      />,
    );
    const gutter = screen.getByTestId("gutter-gutter-1");
    gutter.focus();
    await user.keyboard("{Enter}");
    expect(onCreateHouseAnchorOnGutter).toHaveBeenCalledWith("gutter-1", { x: 50, y: -300, z: 2700 });
  });

  it("responds to Space the same way as Enter for keyboard gutter anchoring", async () => {
    const user = userEvent.setup();
    const onCreateHouseAnchorOnGutter = vi.fn();
    render(
      <PlanView
        scene={sceneWithRoofOverHouse()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onCreateHouseAnchorOnGutter={onCreateHouseAnchorOnGutter}
      />,
    );
    const gutter = screen.getByTestId("gutter-gutter-1");
    gutter.focus();
    await user.keyboard(" ");
    expect(onCreateHouseAnchorOnGutter).toHaveBeenCalledWith("gutter-1", { x: 50, y: -300, z: 2700 });
  });

  it("is not part of the tab order outside the Beam tool", () => {
    render(<PlanView scene={sceneWithRoofOverHouse()} selectedObjectId={null} onSelect={() => {}} tool="select" />);
    expect(screen.getByTestId("gutter-gutter-1")).not.toHaveAttribute("tabIndex");
  });
});
