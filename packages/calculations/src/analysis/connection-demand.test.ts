import { describe, expect, it } from "vitest";
import { reportConnectionDemand } from "./connection-demand.js";

describe("reportConnectionDemand", () => {
  it("reports the supplied demand magnitudes with an always-present engineer-review disclaimer", () => {
    const result = reportConnectionDemand({ jointId: "joint-1", shearN: 4000, axialN: 1000, upliftN: 500, momentNmm: 200000 });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.shearN).toBe(4000);
    expect(result.axialN).toBe(1000);
    expect(result.upliftN).toBe(500);
    expect(result.momentNmm).toBe(200000);
    expect(result.disclaimer).toMatch(/engineer-review-required/i);
    expect(result.disclaimer).toMatch(/connector/i);
  });

  it("fails closed when no demand magnitude is supplied", () => {
    const result = reportConnectionDemand({ jointId: "joint-1" });
    expect(result.status).toBe("input-requires-verification");
    expect(result.disclaimer).toMatch(/engineer-review-required/i);
  });

  it("never approves a connector - the disclaimer is present even when demand is fully calculated", () => {
    const result = reportConnectionDemand({ jointId: "joint-1", shearN: 100 });
    expect(result.status).toBe("calculated-within-stated-assumptions");
    expect(result.disclaimer.length).toBeGreaterThan(0);
  });
});
