import type { Point2D } from "./cut-diagram-layout.js";

export interface PageSizeMm {
  widthMm: number;
  heightMm: number;
}

/** ISO A3 landscape - the default sheet size for the printable blueprint package. */
export const A3_LANDSCAPE_MM: PageSizeMm = { widthMm: 420, heightMm: 297 };

export interface PageLayoutConfig {
  page: PageSizeMm;
  marginMm: number;
  titleBlockHeightMm: number;
}

export const DEFAULT_PAGE_LAYOUT: PageLayoutConfig = {
  page: A3_LANDSCAPE_MM,
  marginMm: 10,
  titleBlockHeightMm: 30,
};

export interface ViewportLayout {
  key: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Fraction of the content area's height given to the primary (plan) view; the rest is split evenly among the secondary views. */
const PRIMARY_HEIGHT_FRACTION = 0.55;

/**
 * A fixed, deterministic sheet grid: one primary view spans the full content
 * width across the top, and any number of secondary views split the
 * remaining row evenly beneath it. No overlap, and every viewport stays
 * inside the page margins and above the title block band.
 */
export function layoutViewports(
  config: PageLayoutConfig,
  primaryKey: string,
  secondaryKeys: string[],
): ViewportLayout[] {
  const contentX = config.marginMm;
  const contentY = config.marginMm;
  const contentWidth = config.page.widthMm - 2 * config.marginMm;
  const contentHeight = config.page.heightMm - 2 * config.marginMm - config.titleBlockHeightMm;

  const hasSecondary = secondaryKeys.length > 0;
  const primaryHeight = hasSecondary ? contentHeight * PRIMARY_HEIGHT_FRACTION : contentHeight;
  const secondaryHeight = contentHeight - primaryHeight;
  const secondaryWidth = hasSecondary ? contentWidth / secondaryKeys.length : 0;

  return [
    { key: primaryKey, xMm: contentX, yMm: contentY, widthMm: contentWidth, heightMm: primaryHeight },
    ...secondaryKeys.map((key, index) => ({
      key,
      xMm: contentX + index * secondaryWidth,
      yMm: contentY + primaryHeight,
      widthMm: secondaryWidth,
      heightMm: secondaryHeight,
    })),
  ];
}

/** Standard denominators for a "1:N" architectural/engineering scale; sheetMm = worldMm / N. */
export const STANDARD_DRAWING_SCALES: number[] = [1, 2, 4, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/** Reserved sheet-space margin (mm) around each view's projected geometry for marks/dimension lines/labels. */
const VIEW_PADDING_MM = 40;

export interface ViewBounds {
  key: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ScaleFitResult {
  scaleDenominator: number;
  isStandardScale: boolean;
}

function requiredSheetSize(bounds: ViewBounds, denominator: number): { widthMm: number; heightMm: number } {
  return {
    widthMm: (bounds.maxX - bounds.minX) / denominator + VIEW_PADDING_MM,
    heightMm: (bounds.maxY - bounds.minY) / denominator + VIEW_PADDING_MM,
  };
}

function fitsAllViewports(viewports: ViewportLayout[], boundsByKey: Map<string, ViewBounds>, denominator: number): boolean {
  return viewports.every((viewport) => {
    const bounds = boundsByKey.get(viewport.key);
    if (!bounds) return true;
    const required = requiredSheetSize(bounds, denominator);
    return required.widthMm <= viewport.widthMm && required.heightMm <= viewport.heightMm;
  });
}

/**
 * Chooses the smallest standard scale denominator (i.e. the largest,
 * most-legible drawing) whose views all fit within their configured
 * viewports. If no standard scale fits - an unusually large structure - it
 * falls back to the smallest denominator that is analytically guaranteed to
 * fit every viewport, so no critical content is ever clipped.
 */
export function selectScale(viewports: ViewportLayout[], bounds: ViewBounds[]): ScaleFitResult {
  const boundsByKey = new Map(bounds.map((b) => [b.key, b]));

  const standard = STANDARD_DRAWING_SCALES.find((denominator) => fitsAllViewports(viewports, boundsByKey, denominator));
  if (standard !== undefined) {
    return { scaleDenominator: standard, isStandardScale: true };
  }

  const largestStandard = STANDARD_DRAWING_SCALES[STANDARD_DRAWING_SCALES.length - 1]!;
  const requiredDenominators = viewports.map((viewport) => {
    const b = boundsByKey.get(viewport.key);
    if (!b) return largestStandard;
    const availableWidth = viewport.widthMm - VIEW_PADDING_MM;
    const availableHeight = viewport.heightMm - VIEW_PADDING_MM;
    const byWidth = availableWidth > 0 ? (b.maxX - b.minX) / availableWidth : Infinity;
    const byHeight = availableHeight > 0 ? (b.maxY - b.minY) / availableHeight : Infinity;
    return Math.max(byWidth, byHeight, largestStandard);
  });

  return { scaleDenominator: Math.max(...requiredDenominators), isStandardScale: false };
}

/**
 * Places a projected sheet-space point (mm, unscaled) inside a viewport at
 * the given scale, centring the view's own bounds within the viewport. Sheet
 * y grows downward while projected y grows upward, so the y axis is
 * inverted here - the one place that flip happens.
 */
export function placeInViewport(
  point: Point2D,
  viewport: ViewportLayout,
  bounds: ViewBounds,
  scaleDenominator: number,
): Point2D {
  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterY = (bounds.minY + bounds.maxY) / 2;
  const viewportCenterX = viewport.xMm + viewport.widthMm / 2;
  const viewportCenterY = viewport.yMm + viewport.heightMm / 2;
  return {
    x: viewportCenterX + (point.x - worldCenterX) / scaleDenominator,
    y: viewportCenterY - (point.y - worldCenterY) / scaleDenominator,
  };
}
