import { describe, it, expect, afterEach, vi } from "vitest";
import { formatMoney, formatMonthLabel, getMonthRange } from "./format";

describe("formatMoney", () => {
  it("formats zero as ¥0", () => {
    expect(formatMoney(0)).toBe("￥0");
  });

  it("formats a positive integer with thousands separators", () => {
    expect(formatMoney(1000)).toBe("￥1,000");
  });

  it("formats negative values with a minus sign", () => {
    expect(formatMoney(-1000)).toBe("-￥1,000");
  });

  it("rounds decimals to the nearest yen (JPY has no minor unit)", () => {
    expect(formatMoney(1234.5)).toBe("￥1,235");
    expect(formatMoney(1234.4)).toBe("￥1,234");
  });

  it("accepts numeric strings, matching the Decimal-as-string API shape", () => {
    expect(formatMoney("12345")).toBe("￥12,345");
  });
});

describe("formatMonthLabel", () => {
  it("converts an ISO month string to a Japanese year/month label", () => {
    expect(formatMonthLabel("2025-01-01")).toBe("2025年1月");
  });

  it("drops the leading zero from single-digit months", () => {
    expect(formatMonthLabel("2025-09-01")).toBe("2025年9月");
  });

  it("keeps two-digit months intact", () => {
    expect(formatMonthLabel("2025-12-01")).toBe("2025年12月");
  });
});

describe("getMonthRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an inclusive range spanning `months` calendar months from the anchor", () => {
    expect(getMonthRange(3, "2025-06-15")).toEqual({
      month_from: "2025-04-01",
      month_to: "2025-06-01",
    });
  });

  it("collapses to a single month when months=1 (boundary)", () => {
    expect(getMonthRange(1, "2025-06-15")).toEqual({
      month_from: "2025-06-01",
      month_to: "2025-06-01",
    });
  });

  it("rolls over into the previous year when the range crosses January", () => {
    // 3 months ending in January 2025 inclusive: Nov 2024, Dec 2024, Jan 2025.
    expect(getMonthRange(3, "2025-01-15")).toEqual({
      month_from: "2024-11-01",
      month_to: "2025-01-01",
    });
  });

  it("keeps a month-start anchor on its own month in any timezone", () => {
    // ChartsPage passes the API's latestMonth, which is always YYYY-MM-01.
    // Parsing that via new Date() lands on UTC midnight and reads back as the
    // previous month west of UTC, so this must hold under TZ=America/New_York.
    expect(getMonthRange(1, "2025-06-01")).toEqual({
      month_from: "2025-06-01",
      month_to: "2025-06-01",
    });
    expect(getMonthRange(1, "2025-01-01")).toEqual({
      month_from: "2025-01-01",
      month_to: "2025-01-01",
    });
    expect(getMonthRange(6, "2025-06-01")).toEqual({
      month_from: "2025-01-01",
      month_to: "2025-06-01",
    });
  });

  it("defaults the anchor to the current date when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15));
    expect(getMonthRange(2)).toEqual({
      month_from: "2025-05-01",
      month_to: "2025-06-01",
    });
  });
});
