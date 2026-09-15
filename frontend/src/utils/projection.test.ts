import { describe, it, expect } from "vitest";
import { calculateTrendProjection } from "./projection";
import type { MonthlyTotal } from "../types";

const totals = (rows: Array<[string, string]>): MonthlyTotal[] =>
  rows.map(([month, total]) => ({ month, total }));

describe("calculateTrendProjection", () => {
  it("returns null for an empty series", () => {
    expect(calculateTrendProjection([], 1)).toBeNull();
  });

  it("returns null for a single data point (no trend to extrapolate)", () => {
    expect(calculateTrendProjection(totals([["2025-01-01", "1000"]]), 1)).toBeNull();
  });

  it("returns null when forecastMonths < 1 (boundary)", () => {
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-02-01", "1100"],
    ]);
    expect(calculateTrendProjection(data, 0)).toBeNull();
  });

  it("returns null when the basis window is narrower than the data's spacing", () => {
    // latest month is Aug; with maxBasisMonths=3 the Jan point falls outside the
    // window, leaving only the latest point itself as a "candidate".
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-08-01", "2000"],
    ]);
    expect(calculateTrendProjection(data, 1, 3)).toBeNull();
  });

  it("returns null when the basis start resolves to the same month as latest (basisMonths=0)", () => {
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-01-01", "1000"],
    ]);
    expect(calculateTrendProjection(data, 1, 6)).toBeNull();
  });

  it("projects a linear trend forward month by month", () => {
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-02-01", "1100"],
    ]);
    const result = calculateTrendProjection(data, 2, 6);
    expect(result).toEqual({
      points: [
        { month: "2025-02-01", total: 1100 },
        { month: "2025-03-01", total: 1200 },
        { month: "2025-04-01", total: 1300 },
      ],
      currentBalance: 1100,
      projectedBalance: 1300,
      difference: 200,
      monthlyChange: 100,
      basisMonths: 1,
      basisFrom: "2025-01-01",
      basisTo: "2025-02-01",
      forecastMonths: 2,
      pointStepMonths: 1,
    });
  });

  it("rounds each projected point to the nearest whole yen", () => {
    // monthlyChange = (1010 - 1000) / 3 = 3.333..., so the next point must round.
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-04-01", "1010"],
    ]);
    const result = calculateTrendProjection(data, 1, 6);
    expect(result?.monthlyChange).toBeCloseTo(3.3333, 3);
    expect(result?.points[1]).toEqual({ month: "2025-05-01", total: 1013 });
  });

  it("switches to a 12-month point step beyond the 5-year threshold and still draws the exact final point", () => {
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-02-01", "1100"],
    ]);
    const result = calculateTrendProjection(data, 61, 6);
    expect(result?.pointStepMonths).toBe(12);
    // 61 is not a multiple of 12, so the loop's last step (60) and the exact
    // forecast endpoint (61) must both be present.
    expect(result?.points[result.points.length - 2]).toEqual({
      month: "2030-02-01",
      total: 7100,
    });
    expect(result?.points[result.points.length - 1]).toEqual({
      month: "2030-03-01",
      total: 7200,
    });
    expect(result?.points).toHaveLength(7);
  });

  it("stays at a 1-month point step exactly at the 60-month threshold (boundary)", () => {
    const data = totals([
      ["2025-01-01", "1000"],
      ["2025-02-01", "1100"],
    ]);
    const result = calculateTrendProjection(data, 60, 6);
    expect(result?.pointStepMonths).toBe(1);
    expect(result?.points).toHaveLength(61);
  });
});
