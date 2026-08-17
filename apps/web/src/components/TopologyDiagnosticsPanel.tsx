import type { TopologyIssue, TopologyIssueKind } from "@canopy/shared";

export type TopologyIssueSeverity = "error" | "warning";

const SEVERITY_BY_KIND: Record<TopologyIssueKind, TopologyIssueSeverity> = {
  "unresolved-connection": "warning",
  "duplicate-member": "error",
  "near-zero-length-member": "error",
  "overlapping-members": "warning",
  "ambiguous-intersection": "warning",
  "joint-needs-resolution": "error",
};

export function topologyIssueSeverity(kind: TopologyIssueKind): TopologyIssueSeverity {
  return SEVERITY_BY_KIND[kind];
}

export interface TopologyDiagnosticsPanelProps {
  issues: TopologyIssue[];
}

export function TopologyDiagnosticsPanel({ issues }: TopologyDiagnosticsPanelProps) {
  return (
    <section aria-label="Topology diagnostics" className="topology-diagnostics">
      <h2>Topology diagnostics{issues.length > 0 && ` (${issues.length})`}</h2>
      {issues.length === 0 ? (
        <p>No topology issues detected. The project is ready to export.</p>
      ) : (
        <>
          <p role="alert">
            Resolve {issues.length} topology issue{issues.length === 1 ? "" : "s"} before exporting.
          </p>
          <ul>
            {issues.map((issue, index) => {
              const severity = topologyIssueSeverity(issue.kind);
              return (
                <li key={`${issue.kind}-${index}`} data-testid={`topology-issue-${index}`} data-severity={severity}>
                  <strong>{severity === "error" ? "Error" : "Warning"}:</strong> {issue.message}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
