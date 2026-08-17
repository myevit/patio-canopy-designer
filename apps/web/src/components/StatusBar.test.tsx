import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar.js";

describe("StatusBar", () => {
  it("always shows the preliminary-planning / engineer-review disclaimer", () => {
    render(<StatusBar tool="select" interaction={{ status: "idle" }} />);
    expect(
      screen.getByText(/preliminary planning information.*not.*professional engineering/i),
    ).toBeInTheDocument();
  });

  it("shows the active tool name", () => {
    render(<StatusBar tool="post" interaction={{ status: "placing" }} />);
    expect(screen.getByText(/post/i)).toBeInTheDocument();
  });

  it("shows the current interaction status", () => {
    render(<StatusBar tool="post" interaction={{ status: "placing" }} />);
    expect(screen.getByText(/placing/i)).toBeInTheDocument();
  });

  it("shows an invalid interaction's reason", () => {
    render(
      <StatusBar tool="beam" interaction={{ status: "invalid", reason: "No anchor at that point" }} />,
    );
    expect(screen.getByText(/no anchor at that point/i)).toBeInTheDocument();
  });

  it("shows a recoverable error while drawing a house outline", () => {
    render(
      <StatusBar
        tool="house"
        interaction={{ status: "drawing-house-outline", points: [], error: "The outline encloses zero area." }}
      />,
    );
    expect(screen.getByText(/the outline encloses zero area/i)).toBeInTheDocument();
  });

  it("prompts for a start anchor at the beginning of the beam flow", () => {
    render(<StatusBar tool="beam" interaction={{ status: "drawing-beam", startAnchorId: null }} />);
    expect(screen.getByText(/choose.*start anchor/i)).toBeInTheDocument();
  });

  it("prompts for an end anchor once a beam's start anchor is chosen", () => {
    render(<StatusBar tool="beam" interaction={{ status: "drawing-beam", startAnchorId: "anchor-1" }} />);
    expect(screen.getByText(/choose.*end anchor/i)).toBeInTheDocument();
  });

  it("prompts for a source anchor at the beginning of the fan flow", () => {
    render(
      <StatusBar
        tool="fan"
        interaction={{ status: "drawing-fan", sourceAnchorId: null, pendingEdgeStartAnchorId: null }}
      />,
    );
    expect(screen.getByText(/choose.*fan source anchor/i)).toBeInTheDocument();
  });

  it("prompts for a fan target once the source anchor is chosen", () => {
    render(
      <StatusBar
        tool="fan"
        interaction={{ status: "drawing-fan", sourceAnchorId: "anchor-1", pendingEdgeStartAnchorId: null }}
      />,
    );
    expect(screen.getByText(/choose.*fan target/i)).toBeInTheDocument();
  });

  it("prompts for a second target anchor once a fan edge start anchor is pending", () => {
    render(
      <StatusBar
        tool="fan"
        interaction={{ status: "drawing-fan", sourceAnchorId: "anchor-1", pendingEdgeStartAnchorId: "anchor-2" }}
      />,
    );
    expect(screen.getByText(/second fan target anchor/i)).toBeInTheDocument();
  });

  it("shows a previewing message once a fan field draft is ready to commit", () => {
    render(
      <StatusBar
        tool="fan"
        interaction={{
          status: "previewing-fan",
          draft: {
            sourceAnchorId: "anchor-1",
            target: { kind: "member", memberId: "member-1" },
            distributionMode: "count",
            count: 5,
            spacingMm: 600,
            reversed: false,
            elevationMode: "linear",
            sagMm: 150,
            sectionId: "sec-rafter",
          },
        }}
      />,
    );
    expect(screen.getByText(/previewing fan field/i)).toBeInTheDocument();
  });

  it("shows a persistence error when one is present", () => {
    render(<StatusBar tool="select" interaction={{ status: "idle" }} persistenceError="disk full" />);
    expect(screen.getByText(/disk full/i)).toBeInTheDocument();
  });

  it("does not show a persistence error section when there is none", () => {
    render(<StatusBar tool="select" interaction={{ status: "idle" }} persistenceError={null} />);
    expect(screen.queryByText(/persistence/i)).not.toBeInTheDocument();
  });
});
