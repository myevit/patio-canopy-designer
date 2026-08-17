import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_LAYOUT,
  STANDARD_DRAWING_SCALES,
  layoutViewports,
  placeInViewport,
  selectScale,
  type ViewBounds,
} from "./blueprint-sheet-layout.js";

describe("layoutViewports", () => {
  it("tiles the primary view full-width on top and secondary views evenly below, within page bounds", () => {
    const viewports = layoutViewports(DEFAULT_PAGE_LAYOUT, "plan", ["front", "side"]);
    const byKey = new Map(viewports.map((v) => [v.key, v]));
    const plan = byKey.get("plan")!;
    const front = byKey.get("front")!;
    const side = byKey.get("side")!;

    const { page, marginMm, titleBlockHeightMm } = DEFAULT_PAGE_LAYOUT;
    const contentRight = page.widthMm - marginMm;
    const contentBottom = page.heightMm - marginMm - titleBlockHeightMm;

    // Nothing extends past the printable content area.
    for (const v of viewports) {
      expect(v.xMm).toBeGreaterThanOrEqual(marginMm);
      expect(v.yMm).toBeGreaterThanOrEqual(marginMm);
      expect(v.xMm + v.widthMm).toBeLessThanOrEqual(contentRight + 1e-6);
      expect(v.yMm + v.heightMm).toBeLessThanOrEqual(contentBottom + 1e-6);
    }

    // Plan spans the full content width; front/side split the remaining row evenly.
    expect(plan.widthMm).toBeCloseTo(contentRight - marginMm, 6);
    expect(front.widthMm).toBeCloseTo(side.widthMm, 6);
    expect(front.yMm).toBeCloseTo(plan.yMm + plan.heightMm, 6);
    // Secondary views don't overlap.
    expect(front.xMm + front.widthMm).toBeCloseTo(side.xMm, 6);
  });

  it("is deterministic", () => {
    const a = layoutViewports(DEFAULT_PAGE_LAYOUT, "plan", ["front", "side"]);
    const b = layoutViewports(DEFAULT_PAGE_LAYOUT, "plan", ["front", "side"]);
    expect(a).toEqual(b);
  });
});

describe("selectScale", () => {
  const viewports = layoutViewports(DEFAULT_PAGE_LAYOUT, "plan", ["front", "side"]);

  it("picks the smallest standard scale denominator that fits every viewport", () => {
    const bounds: ViewBounds[] = viewports.map((v) => ({
      key: v.key,
      minX: 0,
      maxX: 3000,
      minY: 0,
      maxY: 2000,
    }));

    const result = selectScale(viewports, bounds);
    expect(result.isStandardScale).toBe(true);
    expect(STANDARD_DRAWING_SCALES).toContain(result.scaleDenominator);
  });

  it("falls back to a guaranteed-fit non-standard scale for an oversized structure, never clipping", () => {
    const bounds: ViewBounds[] = viewports.map((v) => ({
      key: v.key,
      minX: 0,
      maxX: 500_000,
      minY: 0,
      maxY: 300_000,
    }));

    const result = selectScale(viewports, bounds);
    expect(result.isStandardScale).toBe(false);

    for (const v of viewports) {
      const b = bounds.find((x) => x.key === v.key)!;
      const neededWidth = (b.maxX - b.minX) / result.scaleDenominator;
      const neededHeight = (b.maxY - b.minY) / result.scaleDenominator;
      expect(neededWidth).toBeLessThanOrEqual(v.widthMm);
      expect(neededHeight).toBeLessThanOrEqual(v.heightMm);
    }
  });

  it("is deterministic for the same viewports and bounds", () => {
    const bounds: ViewBounds[] = viewports.map((v) => ({ key: v.key, minX: 0, maxX: 4000, minY: 0, maxY: 2500 }));
    expect(selectScale(viewports, bounds)).toEqual(selectScale(viewports, bounds));
  });
});

describe("placeInViewport", () => {
  it("maps the bounds center to the viewport center", () => {
    const viewport = { key: "plan", xMm: 10, yMm: 10, widthMm: 200, heightMm: 100 };
    const bounds: ViewBounds = { key: "plan", minX: 0, maxX: 2000, minY: 0, maxY: 1000 };
    const placed = placeInViewport({ x: 1000, y: 500 }, viewport, bounds, 10);
    expect(placed.x).toBeCloseTo(viewport.xMm + viewport.widthMm / 2, 6);
    expect(placed.y).toBeCloseTo(viewport.yMm + viewport.heightMm / 2, 6);
  });

  it("keeps every corner of the bounds within the viewport at a scale chosen to fit", () => {
    const viewport = { key: "plan", xMm: 10, yMm: 10, widthMm: 200, heightMm: 100 };
    const bounds: ViewBounds = { key: "plan", minX: 0, maxX: 2000, minY: 0, maxY: 1000 };
    const denominator = 10;
    for (const corner of [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ]) {
      const placed = placeInViewport(corner, viewport, bounds, denominator);
      expect(placed.x).toBeGreaterThanOrEqual(viewport.xMm - 1e-6);
      expect(placed.x).toBeLessThanOrEqual(viewport.xMm + viewport.widthMm + 1e-6);
      expect(placed.y).toBeGreaterThanOrEqual(viewport.yMm - 1e-6);
      expect(placed.y).toBeLessThanOrEqual(viewport.yMm + viewport.heightMm + 1e-6);
    }
  });
});
