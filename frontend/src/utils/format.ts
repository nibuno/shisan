export function formatMoney(value: string | number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(Number(value));
}

export function formatMonthLabel(monthStr: string): string {
  // "2025-01-01" → "2025年1月"
  const [year, month] = monthStr.split("-");
  return `${year}年${parseInt(month)}月`;
}

function monthStartFromIso(dateStr: string): Date {
  const [year, month] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthStartFromDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthRange(
  months: number,
  anchorMonth?: string
): { month_from: string; month_to: string } {
  // new Date("2025-06-01") is parsed as UTC midnight, which reads back as the
  // previous day west of UTC and slips the range a month. Build the date from
  // the string's own parts so the caller's timezone cannot shift it.
  const to = anchorMonth
    ? monthStartFromIso(anchorMonth)
    : monthStartFromDate(new Date());
  const from = new Date(to.getFullYear(), to.getMonth() - months + 1, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return { month_from: fmt(from), month_to: fmt(to) };
}
