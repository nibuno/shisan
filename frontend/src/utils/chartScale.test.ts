import { describe, it, expect } from "vitest";
import { getLineChartScale } from "./chartScale";

describe("getLineChartScale", () => {
  it("returns undefined for an empty array (falls back to Recharts default)", () => {
    expect(getLineChartScale([])).toBeUndefined();
  });

  it("returns undefined when every value is null/undefined", () => {
    expect(getLineChartScale([null, undefined])).toBeUndefined();
  });

  it("returns undefined when the series touches zero (0 must stay the baseline)", () => {
    expect(getLineChartScale([0, 100])).toBeUndefined();
  });

  it("returns undefined when the series goes negative", () => {
    expect(getLineChartScale([-5, 100])).toBeUndefined();
  });

  it("ignores non-finite entries (NaN/Infinity) mixed into the series", () => {
    expect(getLineChartScale([Number.NaN, 100, Number.POSITIVE_INFINITY])).toEqual({
      domain: [92.5, 107.5],
      ticks: [92.5, 95, 97.5, 100, 102.5, 105, 107.5],
    });
  });

  it("widens a single-value series instead of collapsing the axis to a point", () => {
    // dataMin === dataMax, so the MIN_SPAN_RATIO floor must kick in.
    expect(getLineChartScale([100])).toEqual({
      domain: [92.5, 107.5],
      ticks: [92.5, 95, 97.5, 100, 102.5, 105, 107.5],
    });
  });

  it("computes a padded, nicely-rounded domain for a normal range", () => {
    expect(getLineChartScale([null, 100, undefined, 200])).toEqual({
      domain: [75, 225],
      ticks: [75, 100, 125, 150, 175, 200, 225],
    });
  });

  it("widens an all-equal multi-element series the same as a single value", () => {
    expect(getLineChartScale([500, 500, 500])).toEqual({
      domain: [460, 540],
      ticks: [460, 480, 500, 520, 540],
    });
  });

  it("keeps every tick interval equal when the rounded domain spans 10M to 15M", () => {
    expect(getLineChartScale([10_500_000, 14_100_000])).toEqual({
      domain: [10_000_000, 15_000_000],
      ticks: [10_000_000, 11_000_000, 12_000_000, 13_000_000, 14_000_000, 15_000_000],
    });
  });
});
