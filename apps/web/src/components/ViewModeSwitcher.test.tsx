import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewModeSwitcher } from "./ViewModeSwitcher.js";

describe("ViewModeSwitcher", () => {
  it("renders Plan, Split, and 3D options", () => {
    render(<ViewModeSwitcher viewMode="plan" onSelectViewMode={() => {}} />);
    for (const name of ["Plan", "Split", "3D"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the active view mode as pressed", () => {
    render(<ViewModeSwitcher viewMode="split" onSelectViewMode={() => {}} />);
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelectViewMode with the clicked view mode", async () => {
    const user = userEvent.setup();
    const onSelectViewMode = vi.fn();
    render(<ViewModeSwitcher viewMode="plan" onSelectViewMode={onSelectViewMode} />);
    await user.click(screen.getByRole("button", { name: "3D" }));
    expect(onSelectViewMode).toHaveBeenCalledWith("3d");
  });
});
