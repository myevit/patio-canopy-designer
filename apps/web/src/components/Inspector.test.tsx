import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SceneObject, SceneRoofPlane } from "@canopy/geometry";
import { Inspector } from "./Inspector.js";

describe("Inspector", () => {
  it("shows a placeholder when nothing is selected", () => {
    render(<Inspector selected={undefined} />);
    expect(screen.getByText(/no selection/i)).toBeInTheDocument();
  });

  it("shows post details when a post is selected", () => {
    const post: SceneObject = {
      id: "post-1",
      kind: "post",
      base: { x: 100, y: 200, z: 0 },
      top: { x: 100, y: 200, z: 2400 },
      widthMm: 140,
      depthMm: 140,
    };
    render(<Inspector selected={post} />);
    expect(screen.getByText("post-1")).toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
    expect(screen.getByText(/140/)).toBeInTheDocument();
    expect(screen.getByText(/2400/)).toBeInTheDocument();
  });

  it("shows member details when a member is selected", () => {
    const member: SceneObject = {
      id: "member-1",
      kind: "member",
      role: "fan-rafter",
      start: { x: 0, y: 0, z: 2700 },
      end: { x: 0, y: 0, z: 2400 },
      widthMm: 89,
      heightMm: 38,
    };
    render(<Inspector selected={member} />);
    expect(screen.getByText("member-1")).toBeInTheDocument();
    expect(screen.getByText(/fan rafter/i)).toBeInTheDocument();
  });

  it("shows joint details when a joint is selected", () => {
    const joint: SceneObject = {
      id: "joint-1",
      kind: "joint",
      position: { x: 1, y: 2, z: 3 },
      connectedMemberIds: ["member-1", "member-2"],
    };
    render(<Inspector selected={joint} />);
    expect(screen.getByText("joint-1")).toBeInTheDocument();
    expect(screen.getByText(/member-1/)).toBeInTheDocument();
    expect(screen.getByText(/member-2/)).toBeInTheDocument();
  });
});

describe("Inspector vertex editing", () => {
  const outline: SceneObject = {
    id: "house-1",
    kind: "house-outline",
    points: [
      { x: 100, y: 200, z: 0 },
      { x: 400, y: 200, z: 0 },
      { x: 400, y: 500, z: 0 },
    ],
  };

  it("shows numeric X/Y fields for the selected vertex", () => {
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
      />,
    );
    expect(screen.getByLabelText(/vertex x/i)).toHaveValue(100);
    expect(screen.getByLabelText(/vertex y/i)).toHaveValue(200);
  });

  it("commits a moved vertex position on blur", () => {
    const onMoveVertex = vi.fn();
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "150" } });
    fireEvent.blur(xField);
    expect(onMoveVertex).toHaveBeenCalledWith(
      { outlineId: "house-1", index: 0 },
      { x: 150, y: 200, z: 0 },
    );
  });

  it("commits on Enter as well as blur", () => {
    const onMoveVertex = vi.fn();
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const yField = screen.getByLabelText(/vertex y/i);
    fireEvent.change(yField, { target: { value: "999" } });
    fireEvent.keyDown(yField, { key: "Enter" });
    expect(onMoveVertex).toHaveBeenCalledWith(
      { outlineId: "house-1", index: 0 },
      { x: 100, y: 999, z: 0 },
    );
  });

  it("deletes the selected vertex", () => {
    const onDeleteVertex = vi.fn();
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 1 }}
        vertexOutline={outline}
        onDeleteVertex={onDeleteVertex}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete vertex/i }));
    expect(onDeleteVertex).toHaveBeenCalledWith({ outlineId: "house-1", index: 1 });
  });
});

describe("Inspector house outline and roof plane editing", () => {
  const outline: SceneObject = {
    id: "house-1",
    kind: "house-outline",
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 4000, y: 0, z: 0 },
      { x: 4000, y: 3000, z: 0 },
      { x: 0, y: 3000, z: 0 },
    ],
  };

  it("offers to add a roof plane when the selected house outline has none", () => {
    const onAddRoofPlane = vi.fn();
    render(<Inspector selected={outline} roofPlane={null} onAddRoofPlane={onAddRoofPlane} />);
    fireEvent.click(screen.getByRole("button", { name: /add roof plane/i }));
    expect(onAddRoofPlane).toHaveBeenCalledWith("house-1");
  });

  it("shows and edits roof plane fields, preserving an exact 2690 mm reference elevation", () => {
    const roofPlane: SceneRoofPlane = {
      id: "roof-1",
      kind: "roof-plane",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: 0,
      outline: outline.kind === "house-outline" ? outline.points : [],
    };
    render(<Inspector selected={outline} roofPlane={roofPlane} onUpdateRoofPlane={() => {}} />);
    expect(screen.getByLabelText(/reference elevation/i)).toHaveValue(2690);
    expect(screen.getByLabelText(/pitch/i)).toHaveValue(12);
  });

  it("commits a pitch change, converting the displayed degrees back to radians", () => {
    const onUpdateRoofPlane = vi.fn();
    const roofPlane: SceneRoofPlane = {
      id: "roof-1",
      kind: "roof-plane",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: 0,
      outline: [],
    };
    render(<Inspector selected={outline} roofPlane={roofPlane} onUpdateRoofPlane={onUpdateRoofPlane} />);
    const pitchField = screen.getByLabelText(/pitch/i);
    fireEvent.change(pitchField, { target: { value: "20" } });
    fireEvent.blur(pitchField);
    expect(onUpdateRoofPlane).toHaveBeenCalledWith("roof-1", { pitchRad: expect.closeTo((20 * Math.PI) / 180, 10) });
  });

  it("shows and commits gutter fields via onUpdateGutter", () => {
    const onUpdateGutter = vi.fn();
    const roofPlane: SceneRoofPlane = {
      id: "roof-1",
      kind: "roof-plane",
      houseOutlineId: "house-1",
      referenceElevationMm: 2690,
      pitchRad: (12 * Math.PI) / 180,
      directionRad: 0,
      outline: [],
    };
    const gutter = {
      id: "gutter-1",
      kind: "gutter" as const,
      roofPlaneId: "roof-1",
      start: { x: 0, y: 0, z: 2690 },
      end: { x: 4000, y: 0, z: 2690 },
      widthMm: 100,
      dropMm: 50,
    };
    render(
      <Inspector
        selected={outline}
        roofPlane={roofPlane}
        gutter={gutter}
        onUpdateRoofPlane={() => {}}
        onUpdateGutter={onUpdateGutter}
      />,
    );
    expect(screen.getByLabelText(/gutter width/i)).toHaveValue(100);
    const widthField = screen.getByLabelText(/gutter width/i);
    fireEvent.change(widthField, { target: { value: "150" } });
    fireEvent.blur(widthField);
    expect(onUpdateGutter).toHaveBeenCalledWith("gutter-1", { widthMm: 150 });
  });
});

describe("Inspector NumberField hardening", () => {
  const outline: SceneObject = {
    id: "house-1",
    kind: "house-outline",
    points: [
      { x: 100, y: 200, z: 0 },
      { x: 400, y: 200, z: 0 },
      { x: 400, y: 500, z: 0 },
    ],
  };

  it("rejects a non-finite (empty/invalid) value without calling the command, and restores the canonical value", () => {
    const onMoveVertex = vi.fn();
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const xField = screen.getByLabelText(/vertex x/i);
    // The browser sanitizes non-numeric/overflowing text in a <input
    // type="number"> down to an empty value, whose valueAsNumber is NaN.
    fireEvent.change(xField, { target: { value: "" } });
    fireEvent.blur(xField);
    expect(onMoveVertex).not.toHaveBeenCalled();
    expect(xField).toHaveValue(100);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("rejects a non-numeric value without calling the command", () => {
    const onMoveVertex = vi.fn();
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "not-a-number" } });
    fireEvent.blur(xField);
    expect(onMoveVertex).not.toHaveBeenCalled();
    expect(xField).toHaveValue(100);
  });

  it("restores the canonical value and shows an error when the command is rejected", () => {
    const onMoveVertex = vi.fn().mockReturnValue({ ok: false, error: "The outline edges cross each other." });
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "9999" } });
    fireEvent.blur(xField);
    expect(onMoveVertex).toHaveBeenCalled();
    expect(xField).toHaveValue(100);
    expect(screen.getByRole("alert")).toHaveTextContent(/cross each other/i);
  });

  it("clears a previous error once a valid, accepted value is committed", () => {
    const onMoveVertex = vi.fn().mockReturnValue({ ok: true });
    render(
      <Inspector
        selected={undefined}
        selectedVertex={{ outlineId: "house-1", index: 0 }}
        vertexOutline={outline}
        onMoveVertex={onMoveVertex}
      />,
    );
    const xField = screen.getByLabelText(/vertex x/i);
    fireEvent.change(xField, { target: { value: "" } });
    fireEvent.blur(xField);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(xField, { target: { value: "150" } });
    fireEvent.blur(xField);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Inspector keyboard house drawing panel", () => {
  it("shows X/Y coordinate entry, add/remove/close controls while drawing", () => {
    render(<Inspector selected={undefined} drawingPoints={[{ x: 0, y: 0, z: 0 }]} />);
    expect(screen.getByLabelText(/^x \(mm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^y \(mm\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add point/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove last point/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close outline/i })).toBeDisabled();
  });

  it("adds a point from the typed coordinates", () => {
    const onAddDrawingPoint = vi.fn();
    render(<Inspector selected={undefined} drawingPoints={[]} onAddDrawingPoint={onAddDrawingPoint} />);
    fireEvent.change(screen.getByLabelText(/^x \(mm\)/i), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText(/^y \(mm\)/i), { target: { value: "3400" } });
    fireEvent.click(screen.getByRole("button", { name: /add point/i }));
    expect(onAddDrawingPoint).toHaveBeenCalledWith({ x: 1200, y: 3400, z: 0 });
  });

  it("enables Close outline once at least three points are drawn", () => {
    const onCloseDrawing = vi.fn();
    render(
      <Inspector
        selected={undefined}
        drawingPoints={[
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
          { x: 1000, y: 1000, z: 0 },
        ]}
        onCloseDrawing={onCloseDrawing}
      />,
    );
    const closeButton = screen.getByRole("button", { name: /close outline/i });
    expect(closeButton).toBeEnabled();
    fireEvent.click(closeButton);
    expect(onCloseDrawing).toHaveBeenCalled();
  });

  it("removes the last point on click", () => {
    const onRemoveLastDrawingPoint = vi.fn();
    render(
      <Inspector
        selected={undefined}
        drawingPoints={[{ x: 0, y: 0, z: 0 }]}
        onRemoveLastDrawingPoint={onRemoveLastDrawingPoint}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove last point/i }));
    expect(onRemoveLastDrawingPoint).toHaveBeenCalled();
  });
});
