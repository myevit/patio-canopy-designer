import type { CutCardEnd, CutFabricationCard } from "@canopy/geometry";
import { CutDiagramSvg } from "./CutDiagramSvg.js";

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function formatEnd(label: string, end: CutCardEnd) {
  return (
    <div>
      <strong>{label}:</strong> {end.plane.kind} - miter {radToDeg(end.miterRad).toFixed(1)}°, bevel{" "}
      {radToDeg(end.bevelRad).toFixed(1)}°
      {end.roofPlaneId && <span> (from roof plane {end.roofPlaneId})</span>}
    </div>
  );
}

export interface CutsPanelProps {
  cards: CutFabricationCard[];
}

export function CutsPanel({ cards }: CutsPanelProps) {
  if (cards.length === 0) {
    return (
      <section aria-label="Cut list" className="cuts-panel">
        <p>No members to fabricate yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Cut list" className="cuts-panel">
      {cards.map((card) => (
        <article key={card.memberId} data-testid={`cut-card-${card.memberId}`} className="cut-card">
          <h3>{card.memberId}</h3>
          {card.isNearZeroLength ? (
            <p role="alert">This member is near-zero-length and needs review before it can be fabricated.</p>
          ) : (
            <>
              <p>
                Finished length: {Math.round(card.finishedLengthMm)} mm | Stock length:{" "}
                {Math.round(card.stockLengthMm)} mm ({card.fitsStandardStock ? "standard" : "special order"}) | Long
                point: {Math.round(card.longPointMm)} mm | Short point: {Math.round(card.shortPointMm)} mm
              </p>
              {formatEnd("End A", card.endA)}
              {formatEnd("End B", card.endB)}
              <CutDiagramSvg card={card} />
            </>
          )}
        </article>
      ))}
    </section>
  );
}
