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
  if (interaction.status === "drawing-beam") {
    return interaction.startAnchorId ? "Choose an end anchor" : "Choose a start anchor";
  }
  if (interaction.status === "drawing-fan") {
    if (interaction.sourceAnchorId === null) return "Choose a fan source anchor";
    if (interaction.pendingEdgeStartAnchorId === null) return "Choose a fan target (an anchor or a member)";
    return "Choose the second fan target anchor";
  }
  if (interaction.status === "previewing-fan") {
    return "Previewing fan field — adjust and commit in the Inspector";
  }
  if (interaction.status === "drawing-house-outline" && interaction.error) {
    return `${interaction.status}: ${interaction.error}`;
  }
  return interaction.status;
}

export interface StatusBarProps {
  tool: ToolId;
  interaction: InteractionState;
  persistenceError?: string | null;
}

export function StatusBar({ tool, interaction, persistenceError = null }: StatusBarProps) {
  return (
    <footer role="status" aria-label="Status" className="status-bar">
      <p className="status-bar__mode">
        Tool: {TOOL_LABELS[tool]} &middot; State: {describeInteraction(interaction)}
      </p>
      {persistenceError && (
        <p className="status-bar__persistence-error">Persistence error: {persistenceError}</p>
      )}
      <p className="status-bar__disclaimer">{DISCLAIMER_TEXT}</p>
    </footer>
  );
}
