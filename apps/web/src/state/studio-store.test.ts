import { describe, expect, it } from "vitest";
import { initialStudioState, studioReducer } from "./studio-store.js";

describe("initialStudioState", () => {
  it("starts idle in the Select tool with plan view and no selection", () => {
    expect(initialStudioState.tool).toBe("select");
    expect(initialStudioState.interaction).toEqual({ status: "idle" });
    expect(initialStudioState.viewMode).toBe("plan");
    expect(initialStudioState.selectedObjectId).toBeNull();
    expect(initialStudioState.drawerOpen).toBe(false);
  });
});

describe("studioReducer", () => {
  it("switches to the Post tool and enters a placing interaction", () => {
    const next = studioReducer(initialStudioState, { type: "select-tool", tool: "post" });
    expect(next.tool).toBe("post");
    expect(next.interaction).toEqual({ status: "placing" });
  });

  it("switches to the Beam tool and enters a drawing interaction", () => {
    const next = studioReducer(initialStudioState, { type: "select-tool", tool: "beam" });
    expect(next.tool).toBe("beam");
    expect(next.interaction).toEqual({ status: "drawing" });
  });

  it("returns to idle when the Select tool is chosen again", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "fan" });
    const next = studioReducer(drawing, { type: "select-tool", tool: "select" });
    expect(next.interaction).toEqual({ status: "idle" });
  });

  it("selecting an object while the Select tool is active enters a selecting interaction", () => {
    const next = studioReducer(initialStudioState, { type: "select-object", objectId: "post-1" });
    expect(next.selectedObjectId).toBe("post-1");
    expect(next.interaction).toEqual({ status: "selecting" });
  });

  it("clearing the selection returns to idle", () => {
    const selected = studioReducer(initialStudioState, { type: "select-object", objectId: "post-1" });
    const next = studioReducer(selected, { type: "select-object", objectId: null });
    expect(next.selectedObjectId).toBeNull();
    expect(next.interaction).toEqual({ status: "idle" });
  });

  it("escape returns to the Select tool and idle interaction while preserving the current selection", () => {
    const selected = studioReducer(initialStudioState, { type: "select-object", objectId: "post-1" });
    const drawing = studioReducer(selected, { type: "select-tool", tool: "beam" });
    const next = studioReducer(drawing, { type: "escape" });
    expect(next.tool).toBe("select");
    expect(next.interaction).toEqual({ status: "idle" });
    expect(next.selectedObjectId).toBe("post-1");
  });

  it("changes the view mode", () => {
    const next = studioReducer(initialStudioState, { type: "set-view-mode", viewMode: "split" });
    expect(next.viewMode).toBe("split");
  });

  it("opens the drawer on the chosen tab", () => {
    const next = studioReducer(initialStudioState, { type: "set-drawer-tab", tab: "cuts" });
    expect(next.drawerTab).toBe("cuts");
    expect(next.drawerOpen).toBe(true);
  });

  it("toggles the drawer open state", () => {
    const opened = studioReducer(initialStudioState, { type: "toggle-drawer" });
    expect(opened.drawerOpen).toBe(true);
    const closed = studioReducer(opened, { type: "toggle-drawer" });
    expect(closed.drawerOpen).toBe(false);
  });
});
