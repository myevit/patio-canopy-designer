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
      {
        id: "post-1",
        kind: "post",
        base: { x: 0, y: 0, z: 0 },
        top: { x: 0, y: 0, z: 2400 },
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
        end: { x: 1000, y: 500, z: 2400 },
        sectionId: "sec-beam",
        widthMm: 89,
        heightMm: 38,
        rollRad: 0,
      },
    ],
    joints: [
      {
        id: "joint-1",
        kind: "joint",
        position: { x: 500, y: 250, z: 2500 },
        connectedMemberIds: ["member-1"],
        crossingBehavior: "unresolved",
        engineeringStatus: "engineer-review-required",
      },
    ],
    jointCandidates: [],
    houseAnchors: [
      { id: "anchor-house-1", kind: "house-anchor", position: { x: 3000, y: 0, z: 2700 } },
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

  it("renders a mesh for each house anchor", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("scene-object-anchor-house-1")).toBeInTheDocument();
  });

  it("highlights a joint's connected members in-view when the joint is selected", () => {
    render(<ThreeView scene={scene()} selectedObjectId="joint-1" onSelect={() => {}} />);
    const connectedMaterial = screen.getByTestId("scene-object-member-1").querySelector("meshstandardmaterial");
    expect(connectedMaterial).toHaveAttribute("color", "#f2a600");
  });

  it("does not highlight members when no joint is selected", () => {
    render(<ThreeView scene={scene()} selectedObjectId="post-1" onSelect={() => {}} />);
    const ordinaryMaterial = screen.getByTestId("scene-object-member-1").querySelector("meshstandardmaterial");
    expect(ordinaryMaterial).toHaveAttribute("color", "#5b7c99");
  });
});

describe("ThreeView beam flow", () => {
  it("clicking a post while the Beam tool is active chooses its top anchor instead of selecting it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChooseBeamAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-top");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a house anchor while the Beam tool is active chooses it", async () => {
    const user = userEvent.setup();
    const onChooseBeamAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    await user.click(screen.getByTestId("scene-object-anchor-house-1"));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-house-1");
  });

  it("the accessible fallback list routes post selection through the beam-anchor handler when the Beam tool is active", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChooseBeamAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Select post-1 in 3D scene" }));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-top");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("the accessible fallback list also includes house anchors, routed through the beam-anchor handler when the Beam tool is active", async () => {
    const user = userEvent.setup();
    const onChooseBeamAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="beam"
        onChooseBeamAnchor={onChooseBeamAnchor}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Select anchor-house-1 in 3D scene" }));
    expect(onChooseBeamAnchor).toHaveBeenCalledWith("anchor-house-1");
  });

  it("the accessible fallback list's house anchor button is a no-op outside the Beam tool", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={onSelect} tool="select" />);
    await user.click(screen.getByRole("button", { name: "Select anchor-house-1 in 3D scene" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("ThreeView fan flow", () => {
  it("clicking a post while the Fan tool is active chooses its top anchor as the fan source", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChooseFanAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="fan"
        onChooseFanAnchor={onChooseFanAnchor}
      />,
    );
    await user.click(screen.getByTestId("scene-object-post-1"));
    expect(onChooseFanAnchor).toHaveBeenCalledWith("anchor-top");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a house anchor while the Fan tool is active chooses it", async () => {
    const user = userEvent.setup();
    const onChooseFanAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="fan"
        onChooseFanAnchor={onChooseFanAnchor}
      />,
    );
    await user.click(screen.getByTestId("scene-object-anchor-house-1"));
    expect(onChooseFanAnchor).toHaveBeenCalledWith("anchor-house-1");
  });

  it("clicking a member while the Fan tool is active chooses it as the fan target", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onChooseFanTargetMember = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={onSelect}
        tool="fan"
        onChooseFanTargetMember={onChooseFanTargetMember}
      />,
    );
    await user.click(screen.getByTestId("scene-object-member-1"));
    expect(onChooseFanTargetMember).toHaveBeenCalledWith("member-1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("the accessible fallback list routes selection through the fan handlers when the Fan tool is active", async () => {
    const user = userEvent.setup();
    const onChooseFanAnchor = vi.fn();
    render(
      <ThreeView
        scene={scene()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="fan"
        onChooseFanAnchor={onChooseFanAnchor}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Select post-1 in 3D scene" }));
    expect(onChooseFanAnchor).toHaveBeenCalledWith("anchor-top");
  });
});

function sceneWithCandidate(): ScenePrimitives {
  const base = scene();
  return {
    ...base,
    jointCandidates: [
      {
        id: "candidate::crossing::member-1::member-2",
        kind: "joint-candidate",
        candidateKind: "crossing",
        memberIds: ["member-1", "member-2"],
        position: { x: 500, y: 250, z: 2500 },
      },
    ],
  };
}

describe("ThreeView joint candidates", () => {
  it("renders a mesh for a detected candidate while the Joint tool is active", () => {
    render(<ThreeView scene={sceneWithCandidate()} selectedObjectId={null} onSelect={() => {}} tool="joint" />);
    expect(screen.getByTestId("scene-object-candidate::crossing::member-1::member-2")).toBeInTheDocument();
  });

  it("does not render candidate meshes outside the Joint tool", () => {
    render(<ThreeView scene={sceneWithCandidate()} selectedObjectId={null} onSelect={() => {}} tool="select" />);
    expect(screen.queryByTestId("scene-object-candidate::crossing::member-1::member-2")).not.toBeInTheDocument();
  });

  it("calls onSelectCandidate when a candidate mesh is clicked", async () => {
    const user = userEvent.setup();
    const onSelectCandidate = vi.fn();
    render(
      <ThreeView
        scene={sceneWithCandidate()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="joint"
        onSelectCandidate={onSelectCandidate}
      />,
    );
    await user.click(screen.getByTestId("scene-object-candidate::crossing::member-1::member-2"));
    expect(onSelectCandidate).toHaveBeenCalledWith("candidate::crossing::member-1::member-2");
  });

  it("includes joint candidates in the accessible fallback list while the Joint tool is active", () => {
    render(
      <ThreeView scene={sceneWithCandidate()} selectedObjectId={null} onSelect={() => {}} tool="joint" />,
    );
    expect(
      screen.getByRole("button", { name: "Select candidate::crossing::member-1::member-2 in 3D scene" }),
    ).toBeInTheDocument();
  });

  it("does not include joint candidates in the accessible fallback list outside the Joint tool", () => {
    render(
      <ThreeView scene={sceneWithCandidate()} selectedObjectId={null} onSelect={() => {}} tool="select" />,
    );
    expect(
      screen.queryByRole("button", { name: "Select candidate::crossing::member-1::member-2 in 3D scene" }),
    ).not.toBeInTheDocument();
  });

  it("keyboard/AT users can select and confirm a candidate via the accessible fallback list", async () => {
    const user = userEvent.setup();
    const onSelectCandidate = vi.fn();
    render(
      <ThreeView
        scene={sceneWithCandidate()}
        selectedObjectId={null}
        onSelect={() => {}}
        tool="joint"
        onSelectCandidate={onSelectCandidate}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Select candidate::crossing::member-1::member-2 in 3D scene" }),
    );
    expect(onSelectCandidate).toHaveBeenCalledWith("candidate::crossing::member-1::member-2");
  });
});

describe("ThreeView focused joint inspection", () => {
  it("shows only the focused joint and its connected members, hiding unrelated scene objects", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} focusedJointId="joint-1" />);
    expect(screen.getByTestId("scene-object-joint-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-object-member-1")).toBeInTheDocument();
    expect(screen.queryByTestId("scene-object-post-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scene-wall-house-1-wall-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scene-roof-plane-roof-1")).not.toBeInTheDocument();
  });

  it("shows the full scene when no joint is focused", () => {
    render(<ThreeView scene={scene()} selectedObjectId={null} onSelect={() => {}} focusedJointId={null} />);
    expect(screen.getByTestId("scene-object-post-1")).toBeInTheDocument();
    expect(screen.getByTestId("scene-wall-house-1-wall-0")).toBeInTheDocument();
  });
});
