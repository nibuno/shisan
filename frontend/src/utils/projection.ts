import type { MonthlyTotal } from "../types";

export interface ProjectionPoint {
  month: string;
  total: number;
}

export interface TrendProjection {
  points: ProjectionPoint[];
  currentBalance: number;
  projectedBalance: number;
  difference: number;
  monthlyChange: number;
  basisMonths: number;
  basisFrom: string;
  basisTo: string;
  forecastMonths: number;
  /** 予測点の間隔（月）。1 なら月次、12 なら年次。 */
  pointStepMonths: number;
}

/** 予測が5年を超えると月次では点が多すぎるため、年次に間引く。 */
const YEARLY_STEP_THRESHOLD_MONTHS = 60;

function pointStepFor(forecastMonths: number): number {
  return forecastMonths > YEARLY_STEP_THRESHOLD_MONTHS ? 12 : 1;
}

function monthIndex(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return year * 12 + monthNumber - 1;
}

function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return `${year}-${String(monthNumber).padStart(2, "0")}-01`;
}

export function calculateTrendProjection(
  data: MonthlyTotal[],
  forecastMonths: number,
  maxBasisMonths = 6
): TrendProjection | null {
  if (forecastMonths < 1 || maxBasisMonths < 1 || data.length < 2) return null;

  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  const latestIndex = monthIndex(latest.month);
  const basisCandidates = sorted.filter(
    (item) => monthIndex(item.month) >= latestIndex - maxBasisMonths
  );
  if (basisCandidates.length < 2) return null;

  const basisStart = basisCandidates[0];
  const basisMonths = latestIndex - monthIndex(basisStart.month);
  if (basisMonths < 1) return null;

  const currentBalance = Number(latest.total);
  const monthlyChange = (currentBalance - Number(basisStart.total)) / basisMonths;
  const pointStepMonths = pointStepFor(forecastMonths);
  const points: ProjectionPoint[] = [
    { month: latest.month, total: currentBalance },
  ];

  const pushPoint = (offset: number) => {
    points.push({
      month: monthFromIndex(latestIndex + offset),
      total: Math.round(currentBalance + monthlyChange * offset),
    });
  };

  for (let offset = pointStepMonths; offset <= forecastMonths; offset += pointStepMonths) {
    pushPoint(offset);
  }
  // 間引きで最終月が落ちた場合も、予測の終点だけは必ず描く
  if (forecastMonths % pointStepMonths !== 0) {
    pushPoint(forecastMonths);
  }

  const projectedBalance = points[points.length - 1].total;
  return {
    points,
    currentBalance,
    projectedBalance,
    difference: projectedBalance - currentBalance,
    monthlyChange,
    basisMonths,
    basisFrom: basisStart.month,
    basisTo: latest.month,
    forecastMonths,
    pointStepMonths,
  };
}
