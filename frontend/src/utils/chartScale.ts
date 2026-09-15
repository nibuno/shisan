/**
 * 折れ線グラフのY軸の範囲を、データに合わせて決める。
 *
 * Recharts の既定は [0, "auto"] で常に 0 から始まる。1000万円台で推移する残高では
 * 描画領域の7割が空白になり、実際の増減がほぼ平らに見えてしまう。
 * 折れ線は面積で量を表さないため、目盛りが出ている限り 0 始まりでなくてよい。
 *
 * ただし範囲をデータに密着させると、逆に僅かな変動を全画面に拡大して
 * 誇張することになる。資産額では誤読につながるので下限幅を設けている。
 *
 * 積み上げ棒グラフには使わない。棒は 0 からの長さで量を表すため、
 * 0 以外から始めると本当に誤読になる。
 */

/** 目盛り間隔の目安数。これで割った値を「切りのいい」刻みに丸める */
const TARGET_INTERVALS = 5;
/** 上下に取る余白（範囲に対する比率） */
const PAD_RATIO = 0.08;
/** 表示範囲の下限。最大値のこの割合より狭くはしない（微小変動の誇張を防ぐ） */
const MIN_SPAN_RATIO = 0.1;

export interface LineChartScale {
  domain: [number, number];
  ticks: number[];
}

/** 目盛りが読みやすい刻み（1, 2, 2.5, 5, 10 × 10^n）へ丸める */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

/**
 * Y軸の domain と、等間隔の目盛りを返す。
 * 0 や負の値を含む場合は undefined を返し、Recharts の既定（0 始まり）に任せる。
 * 系列が 0 に届くグラフでは 0 が比較の基準になるため、そちらが正しい。
 */
export function getLineChartScale(
  values: Array<number | null | undefined>
): LineChartScale | undefined {
  const numbers = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (numbers.length === 0) return undefined;

  const dataMin = Math.min(...numbers);
  const dataMax = Math.max(...numbers);
  if (dataMin <= 0) return undefined;

  let lower = dataMin;
  let upper = dataMax;
  const minSpan = dataMax * MIN_SPAN_RATIO;
  if (upper - lower < minSpan) {
    const middle = (lower + upper) / 2;
    lower = middle - minSpan / 2;
    upper = middle + minSpan / 2;
  }

  const padding = (upper - lower) * PAD_RATIO;
  const paddedLower = Math.max(0, lower - padding);
  const paddedUpper = upper + padding;

  const step = niceStep((paddedUpper - paddedLower) / TARGET_INTERVALS);
  const niceLower = Math.max(0, Math.floor(paddedLower / step) * step);
  const niceUpper = Math.ceil(paddedUpper / step) * step;

  if (niceLower >= niceUpper) return undefined;

  const tickCount = Math.round((niceUpper - niceLower) / step) + 1;
  const ticks = Array.from({ length: tickCount }, (_, index) => niceLower + index * step);

  return { domain: [niceLower, niceUpper], ticks };
}
