import type { Vector3Mm } from "@canopy/shared";
import type { InteractionState } from "./interaction-state.js";
import type { SelectedVertex } from "./selected-vertex.js";
import type { ToolId } from "./tool.js";

export type ViewMode = "plan" | "split" | "3d";
export type DrawerTab = "bom" | "cuts" | "blueprints";

export interface StudioState {
  tool: ToolId;
  interaction: InteractionState;
  viewMode: ViewMode;
  selectedObjectId: string | null;
  selectedVertex: SelectedVertex | null;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
}

export type StudioAction =
  | { type: "select-tool"; tool: ToolId }
  | { type: "select-object"; objectId: string | null }
  | { type: "select-vertex"; vertex: SelectedVertex | null }
  | { type: "add-outline-point"; point: Vector3Mm }
  | { type: "remove-last-outline-point" }
  | { type: "set-outline-error"; error: string | undefined }
  | { type: "set-interaction"; interaction: InteractionState }
  | { type: "set-beam-start-anchor"; anchorId: string | null }
  | { type: "set-view-mode"; viewMode: ViewMode }
  | { type: "set-drawer-tab"; tab: DrawerTab }
  | { type: "toggle-drawer" }
  | { type: "escape" };

export const initialStudioState: StudioState = {
  tool: "select",
  interaction: { status: "idle" },
  viewMode: "plan",
  selectedObjectId: null,
  selectedVertex: null,
  drawerTab: "bom",
  drawerOpen: false,
};

function interactionForTool(tool: ToolId): InteractionState {
  switch (tool) {
    case "select":
      return { status: "idle" };
    case "house":
      return { status: "drawing-house-outline", points: [] };
    case "post":
    case "joint":
      return { status: "placing" };
    case "beam":
      return { status: "drawing-beam", startAnchorId: null };
    case "fan":
      return { status: "drawing" };
  }
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "select-tool":
      return {
        ...state,
        tool: action.tool,
        interaction: interactionForTool(action.tool),
        selectedVertex: null,
      };
    case "select-object":
      return {
        ...state,
        selectedObjectId: action.objectId,
        selectedVertex: null,
        interaction:
          state.tool === "select"
            ? { status: action.objectId ? "selecting" : "idle" }
            : state.interaction,
      };
    case "select-vertex":
      return {
        ...state,
        selectedVertex: action.vertex,
        selectedObjectId: null,
        interaction:
          state.tool === "select"
            ? { status: action.vertex ? "selecting" : "idle" }
            : state.interaction,
      };
    case "add-outline-point": {
      if (state.interaction.status !== "drawing-house-outline") return state;
      return {
        ...state,
        interaction: {
          status: "drawing-house-outline",
          points: [...state.interaction.points, action.point],
        },
      };
    }
    case "remove-last-outline-point": {
      if (state.interaction.status !== "drawing-house-outline") return state;
      return {
        ...state,
        interaction: {
          status: "drawing-house-outline",
          points: state.interaction.points.slice(0, -1),
        },
      };
    }
    case "set-outline-error": {
      if (state.interaction.status !== "drawing-house-outline") return state;
      return {
        ...state,
        interaction: { ...state.interaction, error: action.error },
      };
    }
    case "set-interaction":
      return { ...state, interaction: action.interaction };
    case "set-beam-start-anchor": {
      if (state.interaction.status !== "drawing-beam") return state;
      return { ...state, interaction: { status: "drawing-beam", startAnchorId: action.anchorId } };
    }
    case "set-view-mode":
      return { ...state, viewMode: action.viewMode };
    case "set-drawer-tab":
      return { ...state, drawerTab: action.tab, drawerOpen: true };
    case "toggle-drawer":
      return { ...state, drawerOpen: !state.drawerOpen };
    case "escape":
      return { ...state, tool: "select", interaction: { status: "idle" } };
  }
}
