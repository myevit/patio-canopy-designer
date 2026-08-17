export type ToolId = "select" | "house" | "post" | "beam" | "fan" | "joint";

export const TOOL_IDS: readonly ToolId[] = ["select", "house", "post", "beam", "fan", "joint"];

export const TOOL_LABELS: Record<ToolId, string> = {
  select: "Select",
  house: "House",
  post: "Post",
  beam: "Beam",
  fan: "Fan",
  joint: "Joint",
};
