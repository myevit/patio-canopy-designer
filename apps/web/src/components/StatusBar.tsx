import type { InteractionState } from "../state/interaction-state.js";
import { TOOL_LABELS, type ToolId } from "../state/tool.js";

export const DISCLAIMER_TEXT =
  "Preliminary planning information only — not a substitute for professional engineering review.";

function describeInteraction(interaction: InteractionState): string {
  if (interaction.status === "invalid") {
    return `Invalid: ${interaction.reason}`;
  }
  if (interaction.status === "dragging") {
    return `Dragging ${interaction.objectId}`;
  }
  if (interaction.status === "drawing-house-outline" && interaction.error) {
    return `${interaction.status}: ${interaction.error}`;
  }
  return interaction.status;
}

export interface StatusBarProps {
  tool: ToolId;
  interaction: InteractionState;
}

export function StatusBar({ tool, interaction }: StatusBarProps) {
  return (
    <footer role="status" aria-label="Status" className="status-bar">
      <p className="status-bar__mode">
        Tool: {TOOL_LABELS[tool]} &middot; State: {describeInteraction(interaction)}
      </p>
      <p className="status-bar__disclaimer">{DISCLAIMER_TEXT}</p>
    </footer>
  );
}
