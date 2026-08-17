import { freezeAnalysisSnapshot } from "@canopy/calculations";
import { CURRENT_SCHEMA_VERSION, type ProjectDocument } from "@canopy/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisPanel } from "./AnalysisPanel.js";

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

function snapshotFor(document: ProjectDocument) {
  return freezeAnalysisSnapshot(document, "2026-08-17T00:00:00.000Z");
}

describe("AnalysisPanel", () => {
  it("always shows an engineer-review / preliminary-planning disclaimer", () => {
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} />);
    expect(screen.getByRole("note", { name: /preliminary/i })).toBeInTheDocument();
  });

  it("lists the beam as an eligible simply-supported member and reports a calculated result", async () => {
    const user = userEvent.setup();
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} />);

    expect(screen.getByRole("option", { name: /beam-1/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/applied uniform load/i), "10");
    await user.type(screen.getByLabelText(/elastic modulus/i), "10000");
    await user.type(screen.getByLabelText(/moment of inertia/i), "100000000");
    await user.click(screen.getByRole("button", { name: /run member check/i }));

    const report = screen.getByTestId("member-analysis-report");
    expect(report).toHaveTextContent(/calculated-within-stated-assumptions/);
    expect(report).toHaveTextContent(/engineer-review-required/i);
    expect(report).toHaveTextContent(/load provenance/i);
    expect(report).toHaveTextContent(/user-defined/i);
    expect(report).toHaveTextContent(/user-entered/i);
  });

  it("reports input-requires-verification when a member check is run with no loads", async () => {
    const user = userEvent.setup();
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} />);
    await user.click(screen.getByRole("button", { name: /run member check/i }));
    expect(screen.getByTestId("member-analysis-report")).toHaveTextContent(/input-requires-verification/);
  });

  it("lists posts and reports a post axial-plus-moment check", async () => {
    const user = userEvent.setup();
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} />);

    await user.type(screen.getByLabelText(/^axial load/i), "50000");
    await user.type(screen.getByLabelText(/end moment/i), "3000000");
    await user.type(screen.getByLabelText(/unbraced length/i), "2400");
    await user.click(screen.getByRole("button", { name: /run post check/i }));

    const report = screen.getByTestId("post-analysis-report");
    expect(report).toHaveTextContent(/input-requires-verification|calculated-within-stated-assumptions/);
    expect(report).toHaveTextContent(/load provenance/i);
    expect(report).toHaveTextContent(/user-entered/i);
  });

  it("excludes a ledger member from the eligible list and explains why nothing is analyzable", () => {
    const document = twoPostFrame();
    document.members[0]!.role = "ledger";
    render(<AnalysisPanel snapshot={snapshotFor(document)} />);
    expect(screen.getByText(/no member is in an explicitly supported analysis scope/i)).toBeInTheDocument();
  });

  it("reports a computed member analysis result to onMemberAnalyzed so it can be reproduced elsewhere (e.g. the permit package)", async () => {
    const user = userEvent.setup();
    const onMemberAnalyzed = vi.fn();
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} onMemberAnalyzed={onMemberAnalyzed} />);
    await user.click(screen.getByRole("button", { name: /run member check/i }));
    expect(onMemberAnalyzed).toHaveBeenCalledTimes(1);
    expect(onMemberAnalyzed).toHaveBeenCalledWith(expect.objectContaining({ memberId: "beam-1" }));
  });

  it("reports a computed post analysis result to onPostAnalyzed so it can be reproduced elsewhere (e.g. the permit package)", async () => {
    const user = userEvent.setup();
    const onPostAnalyzed = vi.fn();
    render(<AnalysisPanel snapshot={snapshotFor(twoPostFrame())} onPostAnalyzed={onPostAnalyzed} />);
    await user.click(screen.getByRole("button", { name: /run post check/i }));
    expect(onPostAnalyzed).toHaveBeenCalledTimes(1);
    expect(onPostAnalyzed).toHaveBeenCalledWith(expect.objectContaining({ postId: "post-a" }));
  });
});
