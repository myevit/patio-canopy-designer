import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SceneObject } from "@canopy/geometry";
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
