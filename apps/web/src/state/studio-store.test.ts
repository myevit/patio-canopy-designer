import { describe, expect, it } from "vitest";
import { createFanDraft } from "./fan-draft.js";
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

  it("switches to the Beam tool and enters a drawing-beam interaction awaiting a start anchor", () => {
    const next = studioReducer(initialStudioState, { type: "select-tool", tool: "beam" });
    expect(next.tool).toBe("beam");
    expect(next.interaction).toEqual({ status: "drawing-beam", startAnchorId: null });
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

describe("studioReducer: house outline drawing", () => {
  it("switches to the House tool and enters an empty drawing-house-outline interaction", () => {
    const next = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    expect(next.interaction).toEqual({ status: "drawing-house-outline", points: [] });
  });

  it("adds a point to the in-progress outline", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    const next = studioReducer(drawing, { type: "add-outline-point", point: { x: 100, y: 200, z: 0 } });
    expect(next.interaction).toEqual({
      status: "drawing-house-outline",
      points: [{ x: 100, y: 200, z: 0 }],
    });
  });

  it("ignores add-outline-point when not drawing a house outline", () => {
    const next = studioReducer(initialStudioState, { type: "add-outline-point", point: { x: 0, y: 0, z: 0 } });
    expect(next).toEqual(initialStudioState);
  });

  it("removes the last drawn point", () => {
    let state = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    state = studioReducer(state, { type: "add-outline-point", point: { x: 0, y: 0, z: 0 } });
    state = studioReducer(state, { type: "add-outline-point", point: { x: 100, y: 0, z: 0 } });
    const next = studioReducer(state, { type: "remove-last-outline-point" });
    expect(next.interaction).toEqual({ status: "drawing-house-outline", points: [{ x: 0, y: 0, z: 0 }] });
  });

  it("removing the last point when there are none is a no-op", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    const next = studioReducer(drawing, { type: "remove-last-outline-point" });
    expect(next.interaction).toEqual({ status: "drawing-house-outline", points: [] });
  });

  it("sets a recoverable error message on the in-progress outline", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    const next = studioReducer(drawing, { type: "set-outline-error", error: "The outline encloses zero area." });
    expect(next.interaction).toEqual({
      status: "drawing-house-outline",
      points: [],
      error: "The outline encloses zero area.",
    });
  });

  it("escape cancels the in-progress outline entirely", () => {
    let state = studioReducer(initialStudioState, { type: "select-tool", tool: "house" });
    state = studioReducer(state, { type: "add-outline-point", point: { x: 0, y: 0, z: 0 } });
    const next = studioReducer(state, { type: "escape" });
    expect(next.interaction).toEqual({ status: "idle" });
    expect(next.tool).toBe("select");
  });
});

describe("studioReducer: beam drawing", () => {
  it("sets the beam start anchor when a start anchor is chosen", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "beam" });
    const next = studioReducer(drawing, { type: "set-beam-start-anchor", anchorId: "anchor-1" });
    expect(next.interaction).toEqual({ status: "drawing-beam", startAnchorId: "anchor-1" });
  });

  it("resets the beam start anchor back to null (e.g. after a beam commits) to draw the next one", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "beam" });
    const started = studioReducer(drawing, { type: "set-beam-start-anchor", anchorId: "anchor-1" });
    const next = studioReducer(started, { type: "set-beam-start-anchor", anchorId: null });
    expect(next.interaction).toEqual({ status: "drawing-beam", startAnchorId: null });
  });

  it("ignores set-beam-start-anchor when not in the drawing-beam interaction", () => {
    const next = studioReducer(initialStudioState, { type: "set-beam-start-anchor", anchorId: "anchor-1" });
    expect(next).toEqual(initialStudioState);
  });

  it("escape cancels the in-progress beam entirely, returning to the Select tool", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "beam" });
    const started = studioReducer(drawing, { type: "set-beam-start-anchor", anchorId: "anchor-1" });
    const next = studioReducer(started, { type: "escape" });
    expect(next.tool).toBe("select");
    expect(next.interaction).toEqual({ status: "idle" });
  });
});

describe("studioReducer: fan drawing", () => {
  it("switches to the Fan tool and enters a drawing-fan interaction awaiting a source anchor", () => {
    const next = studioReducer(initialStudioState, { type: "select-tool", tool: "fan" });
    expect(next.interaction).toEqual({
      status: "drawing-fan",
      sourceAnchorId: null,
      pendingEdgeStartAnchorId: null,
    });
  });

  it("sets the fan source anchor", () => {
    const drawing = studioReducer(initialStudioState, { type: "select-tool", tool: "fan" });
    const next = studioReducer(drawing, { type: "set-fan-source-anchor", anchorId: "anchor-1" });
    expect(next.interaction).toEqual({
      status: "drawing-fan",
      sourceAnchorId: "anchor-1",
      pendingEdgeStartAnchorId: null,
    });
  });

  it("sets a pending edge-start anchor once the source is chosen", () => {
    let state = studioReducer(initialStudioState, { type: "select-tool", tool: "fan" });
    state = studioReducer(state, { type: "set-fan-source-anchor", anchorId: "anchor-1" });
    const next = studioReducer(state, { type: "set-fan-edge-pending-anchor", anchorId: "anchor-2" });
    expect(next.interaction).toEqual({
      status: "drawing-fan",
      sourceAnchorId: "anchor-1",
      pendingEdgeStartAnchorId: "anchor-2",
    });
  });

  it("ignores fan anchor actions when not in the drawing-fan interaction", () => {
    const next = studioReducer(initialStudioState, { type: "set-fan-source-anchor", anchorId: "anchor-1" });
    expect(next).toEqual(initialStudioState);
  });

  it("starts a fan preview with a fully-formed draft", () => {
    const draft = createFanDraft("anchor-1", { kind: "member", memberId: "member-1" }, "sec-rafter");
    const next = studioReducer(initialStudioState, { type: "start-fan-preview", draft });
    expect(next.interaction).toEqual({ status: "previewing-fan", draft });
  });

  it("updates the fan draft in place while previewing", () => {
    const draft = createFanDraft("anchor-1", { kind: "member", memberId: "member-1" }, "sec-rafter");
    const previewing = studioReducer(initialStudioState, { type: "start-fan-preview", draft });
    const next = studioReducer(previewing, { type: "update-fan-draft", patch: { count: 7, reversed: true } });
    expect(next.interaction).toEqual({
      status: "previewing-fan",
      draft: { ...draft, count: 7, reversed: true },
    });
  });

  it("ignores update-fan-draft when not previewing a fan field", () => {
    const next = studioReducer(initialStudioState, { type: "update-fan-draft", patch: { count: 7 } });
    expect(next).toEqual(initialStudioState);
  });

  it("cancelling a fan preview restarts the drawing-fan interaction from scratch", () => {
    const draft = createFanDraft("anchor-1", { kind: "member", memberId: "member-1" }, "sec-rafter");
    const previewing = studioReducer(initialStudioState, { type: "start-fan-preview", draft });
    const next = studioReducer(previewing, { type: "cancel-fan-preview" });
    expect(next.interaction).toEqual({
      status: "drawing-fan",
      sourceAnchorId: null,
      pendingEdgeStartAnchorId: null,
    });
  });

  it("escape cancels an in-progress fan field entirely, returning to the Select tool", () => {
    let state = studioReducer(initialStudioState, { type: "select-tool", tool: "fan" });
    state = studioReducer(state, { type: "set-fan-source-anchor", anchorId: "anchor-1" });
    const next = studioReducer(state, { type: "escape" });
    expect(next.tool).toBe("select");
    expect(next.interaction).toEqual({ status: "idle" });
  });
});

describe("studioReducer: vertex selection", () => {
  it("selects a vertex and clears any object selection", () => {
    const withObject = studioReducer(initialStudioState, { type: "select-object", objectId: "post-1" });
    const next = studioReducer(withObject, {
      type: "select-vertex",
      vertex: { outlineId: "house-1", index: 0 },
    });
    expect(next.selectedVertex).toEqual({ outlineId: "house-1", index: 0 });
    expect(next.selectedObjectId).toBeNull();
    expect(next.interaction).toEqual({ status: "selecting" });
  });

  it("selecting an object clears any vertex selection", () => {
    const withVertex = studioReducer(initialStudioState, {
      type: "select-vertex",
      vertex: { outlineId: "house-1", index: 0 },
    });
    const next = studioReducer(withVertex, { type: "select-object", objectId: "post-1" });
    expect(next.selectedVertex).toBeNull();
    expect(next.selectedObjectId).toBe("post-1");
  });

  it("set-interaction sets the interaction state directly", () => {
    const next = studioReducer(initialStudioState, {
      type: "set-interaction",
      interaction: { status: "invalid", reason: "The outline encloses zero area." },
    });
    expect(next.interaction).toEqual({ status: "invalid", reason: "The outline encloses zero area." });
  });

  it("clearing the vertex selection returns to idle", () => {
    const withVertex = studioReducer(initialStudioState, {
      type: "select-vertex",
      vertex: { outlineId: "house-1", index: 0 },
    });
    const next = studioReducer(withVertex, { type: "select-vertex", vertex: null });
    expect(next.selectedVertex).toBeNull();
    expect(next.interaction).toEqual({ status: "idle" });
  });
});
