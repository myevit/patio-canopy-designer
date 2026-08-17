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
});
