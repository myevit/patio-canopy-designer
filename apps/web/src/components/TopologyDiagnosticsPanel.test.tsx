import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TopologyIssue } from "@canopy/shared";
import { TopologyDiagnosticsPanel, topologyIssueSeverity } from "./TopologyDiagnosticsPanel.js";

describe("topologyIssueSeverity", () => {
  it("marks duplicate, near-zero-length, and stale joints as errors", () => {
    expect(topologyIssueSeverity("duplicate-member")).toBe("error");
    expect(topologyIssueSeverity("near-zero-length-member")).toBe("error");
    expect(topologyIssueSeverity("joint-needs-resolution")).toBe("error");
  });

  it("marks unresolved connections, overlaps, and ambiguous intersections as warnings", () => {
    expect(topologyIssueSeverity("unresolved-connection")).toBe("warning");
    expect(topologyIssueSeverity("overlapping-members")).toBe("warning");
    expect(topologyIssueSeverity("ambiguous-intersection")).toBe("warning");
  });
});

describe("TopologyDiagnosticsPanel", () => {
  it("reports a clean state when there are no issues", () => {
    render(<TopologyDiagnosticsPanel issues={[]} />);
    expect(screen.getByText(/no topology issues/i)).toBeInTheDocument();
  });

  it("lists each issue with its message and severity", () => {
    const issues: TopologyIssue[] = [
      { kind: "unresolved-connection", memberIds: ["m-1", "m-2"], message: "m-1 and m-2 meet but have no joint." },
      { kind: "duplicate-member", memberIds: ["m-3", "m-4"], message: "m-3 and m-4 connect the same anchors." },
    ];
    render(<TopologyDiagnosticsPanel issues={issues} />);
    expect(screen.getByText(/m-1 and m-2 meet but have no joint\./)).toBeInTheDocument();
    expect(screen.getByText(/m-3 and m-4 connect the same anchors\./)).toBeInTheDocument();
    expect(screen.getByTestId("topology-issue-0")).toHaveAttribute("data-severity", "warning");
    expect(screen.getByTestId("topology-issue-1")).toHaveAttribute("data-severity", "error");
    expect(screen.getByText(/2 topology issues/i)).toBeInTheDocument();
  });
});
