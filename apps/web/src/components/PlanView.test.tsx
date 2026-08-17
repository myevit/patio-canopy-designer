import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
      { id: "post-1", kind: "post", base: { x: 50, y: 400, z: 0 }, top: { x: 50, y: 400, z: 2400 }, widthMm: 140, depthMm: 140 },
    ],
    members: [
      {
        id: "member-1",
        kind: "member",
        role: "fan-rafter",
        start: { x: 0, y: 0, z: 2700 },
        end: { x: 50, y: 400, z: 2400 },
        widthMm: 89,
        heightMm: 38,
      },
    ],
    joints: [
      { id: "joint-1", kind: "joint", position: { x: 25, y: 200, z: 2500 }, connectedMemberIds: ["member-1"] },
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
});
