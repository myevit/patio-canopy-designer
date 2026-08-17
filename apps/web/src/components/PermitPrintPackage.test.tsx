import { buildPermitPackage } from "@canopy/geometry";
import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "@canopy/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermitPrintPackage } from "./PermitPrintPackage.js";

function twoPostFrame(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 2,
    metadata: { name: "fixture", createdAt: "2026-01-01T00:00:00.000Z" },
    displayUnits: "mm",
    site: { houseOutlines: [], roofPlanes: [], gutters: [], patioOutlines: [] },
    anchors: [
      { id: "anchor-post-a-base", kind: "post-base", positionMm: { x: 0, y: 0, z: 0 } },
      { id: "anchor-post-a-top", kind: "post-top", positionMm: { x: 0, y: 0, z: 2400 } },
      { id: "anchor-post-b-base", kind: "post-base", positionMm: { x: 4000, y: 0, z: 0 } },
      { id: "anchor-post-b-top", kind: "post-top", positionMm: { x: 4000, y: 0, z: 2400 } },
    ],
    sections: [
      { id: "section-post", name: "140x140 post", widthMm: 140, heightMm: 140 },
      { id: "section-beam", name: "184x38 beam", widthMm: 184, heightMm: 38 },
    ],
    materials: [{ id: "material-1", name: "SPF #2" }],
    posts: [
      {
        id: "post-a",
        baseAnchorId: "anchor-post-a-base",
        topAnchorId: "anchor-post-a-top",
        sectionId: "section-post",
        heightMm: 2400,
      },
      {
        id: "post-b",
        baseAnchorId: "anchor-post-b-base",
        topAnchorId: "anchor-post-b-top",
        sectionId: "section-post",
        heightMm: 2400,
      },
    ],
    members: [
      {
        id: "beam-1",
        role: "perimeter-beam",
        startAnchorId: "anchor-post-a-top",
        endAnchorId: "anchor-post-b-top",
        sectionId: "section-beam",
        materialId: "material-1",
        rollRad: 0,
      },
    ],
    fanFields: [],
    joints: [],
  };
}

describe("PermitPrintPackage", () => {
  it("is hidden from assistive tech, since it duplicates the on-screen preview purely for print", () => {
    const document = twoPostFrame();
    const pkg = buildPermitPackage(document, { generatedAt: "2026-08-17T00:00:00.000Z" });
    render(<PermitPrintPackage pkg={pkg} document={document} />);
    expect(screen.getByTestId("permit-print-package")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the summary page as the page-break start and the drawings page as page-break-before", () => {
    const document = twoPostFrame();
    const pkg = buildPermitPackage(document, { generatedAt: "2026-08-17T00:00:00.000Z" });
    render(<PermitPrintPackage pkg={pkg} document={document} />);
    expect(screen.getByTestId("permit-print-page-summary")).toHaveAttribute("data-page-break", "start");
    expect(screen.getByTestId("permit-print-page-drawings")).toHaveAttribute("data-page-break", "before");
  });

  it("includes the disclaimer and member schedule on the summary page", () => {
    const document = twoPostFrame();
    const pkg = buildPermitPackage(document, { generatedAt: "2026-08-17T00:00:00.000Z" });
    render(<PermitPrintPackage pkg={pkg} document={document} />);
    const summaryPage = screen.getByTestId("permit-print-page-summary");
    expect(summaryPage).toHaveTextContent(/not a permit approval/i);
    expect(summaryPage).toHaveTextContent("beam-1");
  });

  it("reuses BlueprintPrintPackage for the drawings page", () => {
    const document = twoPostFrame();
    const pkg = buildPermitPackage(document, { generatedAt: "2026-08-17T00:00:00.000Z" });
    render(<PermitPrintPackage pkg={pkg} document={document} />);
    expect(screen.getByTestId("blueprint-print-package")).toBeInTheDocument();
  });
});
