import { describe, expect, it } from "vitest";
import { worstStatus } from "./status.js";

describe("worstStatus", () => {
  it("returns the single status unchanged", () => {
    expect(worstStatus(["calculated-within-stated-assumptions"])).toBe("calculated-within-stated-assumptions");
  });

  it("prefers outside-validated-scope over everything else", () => {
    expect(
      worstStatus(["calculated-within-stated-assumptions", "outside-validated-scope", "input-requires-verification"]),
    ).toBe("outside-validated-scope");
  });

  it("prefers check-not-implemented over input-requires-verification", () => {
    expect(worstStatus(["input-requires-verification", "check-not-implemented"])).toBe("check-not-implemented");
  });

  it("leaves an all-calculated set as calculated", () => {
    expect(
      worstStatus(["calculated-within-stated-assumptions", "calculated-within-stated-assumptions"]),
    ).toBe("calculated-within-stated-assumptions");
  });
});
