import type { MemberAnalysisReport, PostAnalysisReport } from "@canopy/calculations";
import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "@canopy/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PermitPackagePanel } from "./PermitPackagePanel.js";

function twoPostFrame(): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
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

const GENERATED_AT = "2026-08-17T00:00:00.000Z";

function renderPanel(
  overrides: Partial<{
    document: ProjectDocument;
    memberAnalysisReports: MemberAnalysisReport[];
    postAnalysisReports: PostAnalysisReport[];
    onPrint: () => void;
  }> = {},
) {
  return render(
    <PermitPackagePanel
      document={overrides.document ?? twoPostFrame()}
      generatedAt={GENERATED_AT}
      memberAnalysisReports={overrides.memberAnalysisReports ?? []}
      postAnalysisReports={overrides.postAnalysisReports ?? []}
      onPrint={overrides.onPrint ?? (() => {})}
    />,
  );
}

describe("PermitPackagePanel", () => {
  it("always shows the permit-package disclaimer: not a permit approval, no code-compliance claim", () => {
    renderPanel();
    const disclaimer = screen.getByRole("note", { name: /permit package disclaimer/i });
    expect(disclaimer).toHaveTextContent(/not a permit approval/i);
    expect(disclaimer).toHaveTextContent(/does not claim code compliance/i);
  });

  it("always shows the engineer-review-required banner for the attached irregular saddle", () => {
    renderPanel();
    expect(screen.getAllByText(/attached irregular saddle/i).length).toBeGreaterThan(0);
  });

  it("lists the member schedule row for the document's beam", () => {
    renderPanel();
    expect(screen.getByTestId("permit-member-beam-1")).toBeInTheDocument();
  });

  it("marks an eligible member with no run report as not-yet-analyzed", () => {
    renderPanel();
    expect(screen.getByTestId("permit-structural-member-beam-1")).toHaveTextContent(/not-yet-analyzed/i);
  });

  it("reproduces a supplied member analysis report's status verbatim", () => {
    const report: MemberAnalysisReport = { memberId: "beam-1", status: "calculated-within-stated-assumptions" };
    renderPanel({ memberAnalysisReports: [report] });
    expect(screen.getByTestId("permit-structural-member-beam-1")).toHaveTextContent(
      /calculated-within-stated-assumptions/i,
    );
  });

  it("shows a footing callout for every post", () => {
    renderPanel();
    expect(screen.getByTestId("permit-footing-post-a")).toBeInTheDocument();
    expect(screen.getByTestId("permit-footing-post-b")).toBeInTheDocument();
  });

  it("draws a north arrow graphic (not just a textual note) on the site plan sheet", () => {
    renderPanel();
    const siteFieldset = screen.getByRole("group", { name: /site plan draft/i });
    const northArrow = within(siteFieldset).getByTestId("permit-site-plan-north-arrow");
    expect(within(northArrow).getByText("N")).toBeInTheDocument();
    expect(northArrow.querySelector("polygon, path")).not.toBeNull();
  });

  it("marks address as not provided until the user enters one", async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(screen.getByTestId("permit-site-address")).toHaveTextContent(/not provided/i);
    await user.type(screen.getByLabelText(/^address/i), "123 Sample St");
    expect(screen.getByTestId("permit-site-address")).toHaveTextContent("123 Sample St");
  });

  it("calls onPrint when the Print button is clicked", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    renderPanel({ onPrint });
    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(onPrint).toHaveBeenCalled();
  });

  it("reuses the blueprint projection engine to render dimensioned plan and elevations", () => {
    renderPanel();
    expect(screen.getAllByTestId("blueprint-member-beam-1").length).toBeGreaterThan(0);
  });

  it("lists unresolved items consistently with the model's topology diagnostics", () => {
    const doc = twoPostFrame();
    doc.anchors.push({ id: "a-3", kind: "free", positionMm: { x: 1500, y: 0, z: 2400 } });
    doc.members.push({
      id: "beam-2",
      role: "perimeter-beam",
      startAnchorId: "anchor-post-a-top",
      endAnchorId: "a-3",
      sectionId: "section-beam",
      rollRad: 0,
    });
    renderPanel({ document: doc });
    expect(screen.getByTestId("permit-unresolved-items")).toHaveTextContent(/unresolved-connection|joint/i);
  });
});
