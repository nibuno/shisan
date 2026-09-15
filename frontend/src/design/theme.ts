/*
 * データ色の設計方針。
 *
 * 画面には「カテゴリ」「口座・資産の系列」「合計と予測」の3種類のデータ色が
 * 同時に出る。これらは全18色あり、次の2条件を満たすよう数値で決めてある。
 *
 *   - 相互の色差が CIEDE2000 で 15 以上（凡例で隣り合っても見分けられる）
 *   - 背景 --bg #f7f6f1 とのコントラストが 3:1 以上（線や面として視認できる）
 *
 * 緑は構造色（ブランド・主要操作）に予約しているので、データ色には使わない。
 * 色相はカテゴリの意味に紐づくため、調整は明度・彩度を優先して行う。
 */
const ASSET_CATEGORY_COLORS = {
  bank: "#4a95c5",
  nisa: "#dc6e58",
  investment: "#ba8428",   // 元の #d39a36 はコントラスト 2.30 で線として薄すぎた
  insurance: "#c36786",
  pension: "#8572b2",
  other: "#5c8288",        // 銀行の青と ΔE 12.7 しかなかったため彩度を落とした
} as const;

/*
 * 名前で判別できないカテゴリ用。名前付きカテゴリの色相を避け、彩度も抑える。
 * 「意味が分かっていない」ものなので、意味を持つ色と張り合わせない。
 */
const FALLBACK_CATEGORY_COLORS = ["#795975", "#8f4d27", "#898b96", "#635e55"];

export const CHART_THEME = {
  grid: "#e8e9e3",
  // 軸ラベルは 13px なので、index.css の --text-muted と同じ AA 準拠の濃さに揃える
  tick: "#68706a",
  // Y軸下端の値とX軸ラベルが近づきすぎないよう、既定の2pxより広く取る
  xTickMargin: 10,
  total: "#2e6d97",
  // 予測は補助情報。実績より彩度を落とし、警告のようには見せない
  projection: "#a88871",
  /*
   * 口座・資産の系列色。カテゴリ色とは役割が違うので、色相ではなく明度の帯で分ける。
   * カテゴリ色が L54-59 に居るのに対し、こちらは L26-44 の暗い帯に置いている。
   * 名義人で絞り込むと口座別グラフとカテゴリ別グラフが同一ページに並ぶため、
   * この2群が混ざらないことが重要になる。
   * 隣り合う ID が似た色にならないよう、色相順ではなく交互に並べている。
   */
  series: ["#a84b4e", "#07454b", "#533728", "#3d456a", "#81641e", "#6c1e52"],
} as const;

export function getChartSeriesColor(id: number): string {
  const index =
    (Math.abs(id) - 1 + CHART_THEME.series.length) % CHART_THEME.series.length;
  return CHART_THEME.series[index];
}

export function getAssetCategoryColor(categoryName: string, categoryId: number): string {
  if (/NISA|ニーサ/i.test(categoryName)) return ASSET_CATEGORY_COLORS.nisa;
  if (/銀行|預金|現金/.test(categoryName)) return ASSET_CATEGORY_COLORS.bank;
  if (/年金/.test(categoryName)) return ASSET_CATEGORY_COLORS.pension;
  if (/保険/.test(categoryName)) return ASSET_CATEGORY_COLORS.insurance;
  if (/証券|株|投資|ファンド/.test(categoryName)) return ASSET_CATEGORY_COLORS.investment;

  const colorIndex =
    (Math.abs(categoryId) - 1 + FALLBACK_CATEGORY_COLORS.length) %
    FALLBACK_CATEGORY_COLORS.length;
  return FALLBACK_CATEGORY_COLORS[colorIndex];
}
