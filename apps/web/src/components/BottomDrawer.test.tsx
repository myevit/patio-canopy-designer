import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomDrawer } from "./BottomDrawer.js";

describe("BottomDrawer", () => {
  it("renders BOM, Cuts, and Blueprints tabs", () => {
    render(<BottomDrawer open tab="bom" onSelectTab={() => {}} onToggleOpen={() => {}} />);
    for (const name of ["BOM", "Cuts", "Blueprints"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("marks the active tab as selected and shows a not-yet-available placeholder", () => {
    render(<BottomDrawer open tab="cuts" onSelectTab={() => {}} onToggleOpen={() => {}} />);
    expect(screen.getByRole("tab", { name: "Cuts" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/not available in this milestone/i)).toBeInTheDocument();
  });

  it("calls onSelectTab when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(<BottomDrawer open tab="bom" onSelectTab={onSelectTab} onToggleOpen={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "Blueprints" }));
    expect(onSelectTab).toHaveBeenCalledWith("blueprints");
  });

  it("hides tab content when closed", () => {
    render(<BottomDrawer open={false} tab="bom" onSelectTab={() => {}} onToggleOpen={() => {}} />);
    expect(screen.queryByText(/not available in this milestone/i)).not.toBeInTheDocument();
  });

  it("renders the given bomContent instead of the placeholder when the BOM tab is active", () => {
    render(
      <BottomDrawer
        open
        tab="bom"
        onSelectTab={() => {}}
        onToggleOpen={() => {}}
        bomContent={<p>Custom BOM content</p>}
      />,
    );
    expect(screen.getByText("Custom BOM content")).toBeInTheDocument();
    expect(screen.queryByText(/not available in this milestone/i)).not.toBeInTheDocument();
  });

  it("renders the given cutsContent instead of the placeholder when the Cuts tab is active", () => {
    render(
      <BottomDrawer
        open
        tab="cuts"
        onSelectTab={() => {}}
        onToggleOpen={() => {}}
        cutsContent={<p>Custom cuts content</p>}
      />,
    );
    expect(screen.getByText("Custom cuts content")).toBeInTheDocument();
  });

  it("calls onToggleOpen when the collapse/expand control is clicked", async () => {
    const user = userEvent.setup();
    const onToggleOpen = vi.fn();
    render(<BottomDrawer open tab="bom" onSelectTab={() => {}} onToggleOpen={onToggleOpen} />);
    await user.click(screen.getByRole("button", { name: /collapse|expand/i }));
    expect(onToggleOpen).toHaveBeenCalled();
  });
});
