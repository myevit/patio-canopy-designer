import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { ScenePrimitives } from "@canopy/geometry";

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { children?: ReactNode; [key: string]: unknown }) => {
    const { children, ...rest } = props;
    return (
      <div data-testid="three-view-canvas" {...rest}>
        {children}
      </div>
    );
  },
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));

const { ThreeView } = await import("./ThreeView.js");

function scene(): ScenePrimitives {
  return {
    houseOutlines: [],
    roofPlanes: [
      {
        id: "roof-1",
        kind: "roof-plane",
        houseOutlineId: "house-1",
        referenceElevationMm: 2700,
        pitchRad: (10 * Math.PI) / 180,
        directionRad: 0,
        outline: [
          { x: 0, y: 0, z: 2700 },
          { x: 4000, y: 0, z: 2400 },
          { x: 4000, y: 3000, z: 2400 },
          { x: 0, y: 3000, z: 2700 },
        ],
      },
    ],
    gutters: [
      {
        id: "gutter-1",
        kind: "gutter",
        roofPlaneId: "roof-1",
        start: { x: 4000, y: 0, z: 2400 },
        end: { x: 4000, y: 3000, z: 2400 },
        widthMm: 100,
        dropMm: 50,
      },
    ],
    walls: [{ id: "house-1-wall-0", kind: "wall", start: { x: 0, y: 0, z: 0 }, end: { x: 4000, y: 0, z: 0 }, heightMm: 2700 }],
    patioOutlines: [],
    posts: [
      { id: "post-1", kind: "post", base: { x: 0, y: 0, z: 0 }, top: { x: 0, y: 0, z: 2400 }, widthMm: 140, depthMm: 140 },
    ],
    members: [
      {
        id: "member-1",
        kind: "member",
        role: "fan-rafter",
        start: { x: 0, y: 0, z: 2700 },
        end: { x: 1000, y: 500, z: 2400 },
        widthMm: 89,
        heightMm: 38,
      },
    ],
    joints: [
      { id: "joint-1", kind: "joint", position: { x: 500, y: 250, z: 2500 }, connectedMemberIds: ["member-1"] },
    ],
  };
}

describe("ThreeView", () => {
  it("renders the canvas with one clickable object per post, member, and joint", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("three-view-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-member-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-joint-1")).toBeInTheDocument();
  });

  it("renders a wall panel and a roof plane mesh", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("scene-wall-house-1-wall-0")).toBeInTheDocument();
    expect(screen.getByTestId("scene-roof-plane-roof-1")).toBeInTheDocument();
  });

  it("renders a gutter mesh", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("scene-gutter-gutter-1")).toBeInTheDocument();
  });

  it("calls onSelect with the member id when the member mesh is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={onSelect} />);
    await user.click(screen.getByTestId("scene-object-member-1"));
    expect(onSelect).toHaveBeenCalledWith("member-1");
  });

  it("marks the selected object distinctly", () => {
    render(<ThreeView scene={scene()} selectedObjectId="post-1" onSelect={() => {}} />);
    const selectedMaterial = screen.getByTestId("scene-object-post-1").querySelector("meshstandardmaterial");
    const ordinaryMaterial = screen.getByTestId("scene-object-member-1").querySelector("meshstandardmaterial");
    expect(selectedMaterial).toHaveAttribute("color", "#f2a600");
    expect(ordinaryMaterial).toHaveAttribute("color", "#5b7c99");
  });
});
