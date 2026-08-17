import { buildCutDiagramLayout, type CutFabricationCard, type Point2D } from "@canopy/geometry";

function pointsAttr(points: Point2D[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export interface CutDiagramSvgProps {
  card: CutFabricationCard;
}

/** Renders the side + end views computed by buildCutDiagramLayout - a plain visualization of already-validated geometry, no numbers re-entered by hand. */
export function CutDiagramSvg({ card }: CutDiagramSvgProps) {
  const layout = buildCutDiagramLayout(card);
  const halfHeight = card.sectionHeightMm / 2;
  const sideMargin = Math.max(card.sectionHeightMm, card.finishedLengthMm * 0.05);
  const sideViewBox = `${-sideMargin} ${-halfHeight - sideMargin} ${card.finishedLengthMm + 2 * sideMargin} ${card.sectionHeightMm + 2 * sideMargin}`;

  const halfWidth = card.sectionWidthMm / 2;
  const endMargin = Math.max(card.sectionWidthMm, card.sectionHeightMm) * 0.3;
  const endViewBox = `${-halfWidth - endMargin} ${-halfHeight - endMargin} ${card.sectionWidthMm + 2 * endMargin} ${card.sectionHeightMm + 2 * endMargin}`;

  return (
    <figure className="cut-diagram" aria-label={`Cut diagram for ${card.memberId}`}>
      <svg role="img" aria-label="Side view" viewBox={sideViewBox} className="cut-diagram__side-view">
        <polygon data-testid="cut-diagram-side-view" points={pointsAttr(layout.sideView.outline)} />
      </svg>
      <div className="cut-diagram__end-views">
        <svg role="img" aria-label="End A view" viewBox={endViewBox} className="cut-diagram__end-view">
          <polygon data-testid="cut-diagram-end-view-a" points={pointsAttr(layout.endViewA.outline)} />
          <circle data-testid="cut-diagram-end-view-a-long" cx={layout.endViewA.longCorner.x} cy={layout.endViewA.longCorner.y} r={2} />
          <circle data-testid="cut-diagram-end-view-a-short" cx={layout.endViewA.shortCorner.x} cy={layout.endViewA.shortCorner.y} r={2} />
        </svg>
        <svg role="img" aria-label="End B view" viewBox={endViewBox} className="cut-diagram__end-view">
          <polygon data-testid="cut-diagram-end-view-b" points={pointsAttr(layout.endViewB.outline)} />
          <circle data-testid="cut-diagram-end-view-b-long" cx={layout.endViewB.longCorner.x} cy={layout.endViewB.longCorner.y} r={2} />
          <circle data-testid="cut-diagram-end-view-b-short" cx={layout.endViewB.shortCorner.x} cy={layout.endViewB.shortCorner.y} r={2} />
        </svg>
      </div>
    </figure>
  );
}
