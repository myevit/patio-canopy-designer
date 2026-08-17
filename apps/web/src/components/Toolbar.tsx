import { TOOL_IDS, TOOL_LABELS, type ToolId } from "../state/tool.js";

export interface ToolbarProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
}

export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Drawing tools" className="toolbar">
      {TOOL_IDS.map((tool) => (
        <button
          key={tool}
          type="button"
          aria-pressed={tool === activeTool}
          onClick={() => onSelectTool(tool)}
          className={tool === activeTool ? "toolbar-button toolbar-button--active" : "toolbar-button"}
        >
          {TOOL_LABELS[tool]}
        </button>
      ))}
    </div>
  );
}
