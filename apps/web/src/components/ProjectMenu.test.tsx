import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { ProjectMenu } from "./ProjectMenu.js";

function renderMenu(overrides: Partial<ComponentProps<typeof ProjectMenu>> = {}) {
  const props = {
    canUndo: false,
    canRedo: false,
    onNew: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...overrides,
  };
  render(<ProjectMenu {...props} />);
  return props;
}

describe("ProjectMenu", () => {
  it("renders New, Export, Import, Undo, and Redo controls", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: /new/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/import/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redo/i })).toBeInTheDocument();
  });

  it("calls onNew when New is clicked", async () => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByRole("button", { name: /new/i }));
    expect(props.onNew).toHaveBeenCalled();
  });

  it("calls onExport when Export is clicked", async () => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(props.onExport).toHaveBeenCalled();
  });

  it("calls onImport with the selected file", () => {
    const props = renderMenu();
    const file = new File(["{}"], "project.json", { type: "application/json" });
    const input = screen.getByLabelText(/import/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onImport).toHaveBeenCalledWith(file);
  });

  it("disables Undo and Redo when unavailable", () => {
    renderMenu({ canUndo: false, canRedo: false });
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /redo/i })).toBeDisabled();
  });

  it("calls onUndo and onRedo when enabled and clicked", async () => {
    const user = userEvent.setup();
    const props = renderMenu({ canUndo: true, canRedo: true });
    await user.click(screen.getByRole("button", { name: /undo/i }));
    await user.click(screen.getByRole("button", { name: /redo/i }));
    expect(props.onUndo).toHaveBeenCalled();
    expect(props.onRedo).toHaveBeenCalled();
  });
});
