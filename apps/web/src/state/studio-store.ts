import type { InteractionState } from "./interaction-state.js";
import type { ToolId } from "./tool.js";

export type ViewMode = "plan" | "split" | "3d";
export type DrawerTab = "bom" | "cuts" | "blueprints";

export interface StudioState {
  tool: ToolId;
  interaction: InteractionState;
  viewMode: ViewMode;
  selectedObjectId: string | null;
  drawerTab: DrawerTab;
  drawerOpen: boolean;
}

export type StudioAction =
  | { type: "select-tool"; tool: ToolId }
  | { type: "select-object"; objectId: string | null }
  | { type: "set-view-mode"; viewMode: ViewMode }
  | { type: "set-drawer-tab"; tab: DrawerTab }
  | { type: "toggle-drawer" }
  | { type: "escape" };

export const initialStudioState: StudioState = {
  tool: "select",
  interaction: { status: "idle" },
  viewMode: "plan",
  selectedObjectId: null,
  drawerTab: "bom",
  drawerOpen: false,
};

function interactionForTool(tool: ToolId): InteractionState {
  switch (tool) {
    case "select":
      return { status: "idle" };
    case "house":
    case "post":
    case "joint":
      return { status: "placing" };
    case "beam":
    case "fan":
      return { status: "drawing" };
  }
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "select-tool":
      return { ...state, tool: action.tool, interaction: interactionForTool(action.tool) };
    case "select-object":
      return {
        ...state,
        selectedObjectId: action.objectId,
        interaction:
          state.tool === "select"
            ? { status: action.objectId ? "selecting" : "idle" }
            : state.interaction,
      };
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
