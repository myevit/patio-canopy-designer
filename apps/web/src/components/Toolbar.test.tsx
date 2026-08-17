import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./Toolbar.js";

describe("Toolbar", () => {
  it("renders a button for each tool", () => {
    render(<Toolbar activeTool="select" onSelectTool={() => {}} />);
    for (const name of ["Select", "House", "Post", "Beam", "Fan", "Joint"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks only the active tool as pressed", () => {
    render(<Toolbar activeTool="post" onSelectTool={() => {}} />);
    expect(screen.getByRole("button", { name: "Post" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelectTool with the clicked tool id", async () => {
    const user = userEvent.setup();
    const onSelectTool = vi.fn();
    render(<Toolbar activeTool="select" onSelectTool={onSelectTool} />);
    await user.click(screen.getByRole("button", { name: "Beam" }));
    expect(onSelectTool).toHaveBeenCalledWith("beam");
  });
});
