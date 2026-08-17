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
    roofPlanes: [],
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
