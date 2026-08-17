import { A3_LANDSCAPE_MM, DEFAULT_PAGE_LAYOUT, type BlueprintSheet, type Point2D } from "@canopy/geometry";

function pointsAttr(points: Point2D[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Print scale can't be honored on arbitrary paper/printer setups - browsers may shrink-to-fit regardless of `@page` sizing - so the printed title block must say so plainly instead of asserting an exact `1:N` fit. */
const PRINT_SCALE_LABEL = "Indicative — not to scale";
const PRINT_SCALE_FOOTNOTE =
  "Scale is indicative only; exact 1:N fit on paper is not guaranteed across browsers and printers. Use the printed dimension callouts, not a ruler on the drawing.";

export interface BlueprintSheetSvgProps {
  sheet: BlueprintSheet;
  pageSize?: { widthMm: number; heightMm: number };
  /** "screen" (default) shows the sheet's computed scale for reference; "print" replaces it with an honest, paper-independent label. */
  mode?: "screen" | "print";
}

/** Renders one already-laid-out blueprint sheet - a plain visualization of validated, projected geometry, no numbers re-entered by hand. */
export function BlueprintSheetSvg({ sheet, pageSize = A3_LANDSCAPE_MM, mode = "screen" }: BlueprintSheetSvgProps) {
  const { titleBlock } = sheet;
  const titleBlockHeightMm = DEFAULT_PAGE_LAYOUT.titleBlockHeightMm;
  const contentHeightMm = pageSize.heightMm - titleBlockHeightMm;
  const viewBox = `0 0 ${pageSize.widthMm} ${contentHeightMm}`;
  const scaleLabel = mode === "print" ? PRINT_SCALE_LABEL : titleBlock.scale;

  return (
    <figure
      className={`blueprint-sheet blueprint-sheet--${mode}`}
      aria-label={`Blueprint sheet ${titleBlock.sheetNumber} of ${titleBlock.sheetCount}`}
    >
      <svg role="img" aria-label="Blueprint sheet" viewBox={viewBox} className="blueprint-sheet__svg">
        {sheet.views.map((view) => (
          <g key={view.key} data-testid={`blueprint-view-${view.key}`}>
            <text
              x={view.viewport.xMm}
              y={view.viewport.yMm - 2}
              className="blueprint-sheet__view-title"
            >
              {view.title}
            </text>
            <rect
              x={view.viewport.xMm}
              y={view.viewport.yMm}
              width={view.viewport.widthMm}
              height={view.viewport.heightMm}
              className="blueprint-sheet__viewport-frame"
            />
            {view.members.map((member) => (
              <g key={member.memberId}>
                <polygon
                  data-testid={`blueprint-member-${member.memberId}`}
                  points={pointsAttr(member.outline)}
                  className="blueprint-sheet__member"
                />
                {member.outline[0] && (
                  <text x={member.outline[0].x} y={member.outline[0].y} className="blueprint-sheet__mark">
                    {member.mark}
                  </text>
                )}
              </g>
            ))}
            {view.joints.map((joint) => (
              <g key={joint.jointId}>
                <circle
                  data-testid={`blueprint-joint-${joint.jointId}`}
                  cx={joint.position.x}
                  cy={joint.position.y}
                  r={2}
                  className="blueprint-sheet__joint"
                />
                <text x={joint.position.x + 3} y={joint.position.y - 3} className="blueprint-sheet__mark">
                  {joint.mark}
                </text>
              </g>
            ))}
            {view.dimensions.map((dimension, index) => (
              <g key={index}>
                <line
                  x1={dimension.a.x}
                  y1={dimension.a.y}
                  x2={dimension.b.x}
                  y2={dimension.b.y}
                  className="blueprint-sheet__dimension-line"
                />
                <text
                  x={(dimension.a.x + dimension.b.x) / 2}
                  y={(dimension.a.y + dimension.b.y) / 2 - 2}
                  className="blueprint-sheet__dimension-label"
                >
                  {dimension.label}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>

      {sheet.views.length === 0 && (
        <div data-testid="blueprint-unresolved-schedule" className="blueprint-sheet__schedule">
          {sheet.unresolvedItems.length === 0 ? (
            <p>No unresolved items.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Members</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {sheet.unresolvedItems.map((issue, index) => (
                  <tr key={index} data-testid={`unresolved-item-row-${index}`}>
                    <td>{issue.kind}</td>
                    <td>{issue.memberIds.join(", ")}</td>
                    <td>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div data-testid="blueprint-title-block" className="blueprint-sheet__title-block">
        <div className="blueprint-sheet__title-block-fields">
          <span>{titleBlock.projectName}</span>
          <span>Rev {titleBlock.revision}</span>
          <span>{titleBlock.date}</span>
          <span data-testid="blueprint-title-block-scale">{scaleLabel}</span>
          <span>
            Sheet {titleBlock.sheetNumber} of {titleBlock.sheetCount}
          </span>
        </div>
        {mode === "print" && (
          <p data-testid="blueprint-print-scale-footnote" className="blueprint-sheet__print-footnote">
            {PRINT_SCALE_FOOTNOTE}
          </p>
        )}
      </div>
    </figure>
  );
}
