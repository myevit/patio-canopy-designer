import type { CutFabricationCard } from "@canopy/geometry";
import { squareCut } from "@canopy/geometry";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CutsPanel } from "./CutsPanel.js";

function card(overrides: Partial<CutFabricationCard> = {}): CutFabricationCard {
  const endA = squareCut(0, -1);
  const endB = squareCut(3000, 1);
  return {
    memberId: "rafter-1",
    kind: "beam",
    sectionId: "sec-1",
    materialId: undefined,
    sectionWidthMm: 89,
    sectionHeightMm: 38,
    finishedLengthMm: 3000,
    longPointMm: 3000,
    shortPointMm: 3000,
    stockAllowanceMm: 50,
    stockLengthMm: 3600,
    fitsStandardStock: true,
    isNearZeroLength: false,
    endA: { plane: endA, miterRad: 0, bevelRad: 0, roofPlaneId: null },
    endB: { plane: endB, miterRad: 0, bevelRad: 0, roofPlaneId: null },
    ...overrides,
  };
}

describe("CutsPanel", () => {
  it("renders one cut card per member, traceable by its member id", () => {
    render(<CutsPanel cards={[card({ memberId: "rafter-1" }), card({ memberId: "rafter-2" })]} />);
    expect(screen.getByTestId("cut-card-rafter-1")).toBeInTheDocument();
    expect(screen.getByTestId("cut-card-rafter-2")).toBeInTheDocument();
  });

  it("shows the finished length, stock length, and each end's cut kind", () => {
    render(<CutsPanel cards={[card()]} />);
    const cutCard = screen.getByTestId("cut-card-rafter-1");
    expect(within(cutCard).getByText(/3000 mm/)).toBeInTheDocument();
    expect(within(cutCard).getByText(/3600 mm/)).toBeInTheDocument();
    expect(within(cutCard).getAllByText(/square/i).length).toBeGreaterThan(0);
  });

  it("reports a roof-plane cut with a nonzero bevel/miter angle in degrees", () => {
    render(
      <CutsPanel
        cards={[
          card({
            endB: { plane: squareCut(3000, 1), miterRad: 0, bevelRad: (25 * Math.PI) / 180, roofPlaneId: "roof-1" },
          }),
        ]}
      />,
    );
    const cutCard = screen.getByTestId("cut-card-rafter-1");
    expect(within(cutCard).getByText(/roof-1/)).toBeInTheDocument();
    expect(within(cutCard).getByText(/25(\.0)?\s*°/)).toBeInTheDocument();
  });

  it("flags a near-zero-length card instead of rendering a diagram for it", () => {
    render(<CutsPanel cards={[card({ isNearZeroLength: true })]} />);
    const cutCard = screen.getByTestId("cut-card-rafter-1");
    expect(within(cutCard).getByRole("alert")).toHaveTextContent(/near-zero/i);
  });

  it("shows an empty-state message when there are no cards", () => {
    render(<CutsPanel cards={[]} />);
    expect(screen.getByText(/no members to fabricate/i)).toBeInTheDocument();
  });
});
