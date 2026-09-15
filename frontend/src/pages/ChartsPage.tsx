import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  analyticsApi,
  assetsApi,
  categoriesApi,
  ownersApi,
} from "../api/client";
import type {
  Asset,
  AssetTotal,
  Category,
  CategoryTotal,
  MonthlyTotal,
  Owner,
} from "../types";
import TotalAssetLineChart from "../components/charts/TotalAssetLineChart";
import CategoryLineChart from "../components/charts/CategoryLineChart";
import CategoryStackedBarChart from "../components/charts/CategoryStackedBarChart";
import AssetLineChart from "../components/charts/AssetLineChart";
import { formatMoney, formatMonthLabel, getMonthRange } from "../utils/format";
import { calculateTrendProjection } from "../utils/projection";

const PERIODS = [
  { label: "6ヶ月", months: 6 },
  { label: "12ヶ月", months: 12 },
  { label: "24ヶ月", months: 24 },
];

const FORECAST_OPTIONS = [
  { label: "半年", months: 6 },
  { label: "1年", months: 12 },
  { label: "5年", months: 60 },
  { label: "10年", months: 120 },
  { label: "30年", months: 360 },
];

function parseId(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default function ChartsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriod = Number(searchParams.get("period"));
  const period = PERIODS.some((item) => item.months === requestedPeriod)
    ? requestedPeriod
    : 12;
  const ownerId = parseId(searchParams.get("owner_id"));
  const categoryId = parseId(searchParams.get("category_id"));
  const assetId = parseId(searchParams.get("asset_id"));

  const [owners, setOwners] = useState<Owner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<MonthlyTotal[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryTotal[]>([]);
  const [assetData, setAssetData] = useState<AssetTotal[]>([]);
  const [latestMonth, setLatestMonth] = useState<string | null>();
  const [showProjection, setShowProjection] = useState(false);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      ownersApi.list(),
      categoriesApi.list(),
      assetsApi.list(),
      analyticsApi.dashboard(),
    ])
      .then(([ownerList, categoryList, assetList, dashboard]) => {
        setOwners(ownerList);
        setCategories(categoryList);
        setAssets(assetList);
        setLatestMonth(dashboard.latest_month || null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          (!ownerId || asset.owner.id === ownerId) &&
          (!categoryId || asset.category.id === categoryId)
      ),
    [assets, ownerId, categoryId]
  );

  useEffect(() => {
    if (!assetId || assets.length === 0) return;
    if (filteredAssets.some((asset) => asset.id === assetId)) return;
    const next = new URLSearchParams(searchParams);
    next.delete("asset_id");
    setSearchParams(next, { replace: true });
  }, [assetId, assets.length, filteredAssets, searchParams, setSearchParams]);

  const fetchChartData = useCallback(() => {
    if (latestMonth === undefined) return;

    const range = getMonthRange(period, latestMonth ?? undefined);
    const filters = {
      ...range,
      ...(ownerId ? { owner_id: ownerId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(assetId ? { asset_id: assetId } : {}),
    };
    setLoading(true);
    Promise.all([
      analyticsApi.monthlyTotal(filters),
      analyticsApi.byCategory(filters),
      analyticsApi.byAsset(filters),
    ])
      .then(([total, byCategory, byAsset]) => {
        setMonthlyTotal(total);
        setCategoryData(byCategory);
        setAssetData(byAsset);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [latestMonth, period, ownerId, categoryId, assetId]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const setFilter = (
    key: "owner_id" | "category_id" | "asset_id" | "period",
    value: string
  ) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "owner_id" || key === "category_id") {
      next.delete("asset_id");
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("owner_id");
    next.delete("category_id");
    next.delete("asset_id");
    setSearchParams(next, { replace: true });
  };

  const selectedOwner = owners.find((owner) => owner.id === ownerId);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  const filterParts = [
    selectedOwner?.name ?? selectedAsset?.owner.name,
    selectedCategory?.name ?? selectedAsset?.category.name,
    selectedAsset?.name,
  ].filter(Boolean);
  const filterLabel = filterParts.length ? filterParts.join(" / ") : "すべての資産";
  const hasFilter = Boolean(ownerId || categoryId || assetId);
  const visibleCategories = categoryId
    ? categories.filter((category) => category.id === categoryId)
    : categories;
  const hasData = monthlyTotal.length > 0;
  const projection = useMemo(
    () => calculateTrendProjection(monthlyTotal, forecastMonths),
    [monthlyTotal, forecastMonths]
  );

  return (
    <div className="charts-page">
      <div className="page-header">
        <h1>資産推移</h1>
      </div>

      {error && (
        <div className="error-message" onClick={() => setError(null)}>
          {error}（クリックで閉じる）
        </div>
      )}

      <section className="chart-filter-panel" aria-label="グラフの表示条件">
        <div className="filter-bar chart-filter-bar">
          <label className="filter-field">
            <span>名義人</span>
            <select
              aria-label="名義人"
              value={ownerId ?? ""}
              onChange={(event) => setFilter("owner_id", event.target.value)}
            >
              <option value="">すべて</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>カテゴリ</span>
            <select
              aria-label="カテゴリ"
              value={categoryId ?? ""}
              onChange={(event) => setFilter("category_id", event.target.value)}
            >
              <option value="">すべて</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field filter-field-wide">
            <span>口座・資産</span>
            <select
              aria-label="口座・資産"
              value={assetId ?? ""}
              onChange={(event) => setFilter("asset_id", event.target.value)}
              disabled={filteredAssets.length === 0}
            >
              <option value="">すべて</option>
              {filteredAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}（{asset.owner.name}）
                </option>
              ))}
            </select>
          </label>
          {hasFilter && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              絞り込みを解除
            </button>
          )}
        </div>
        <div className="chart-filter-footer">
          <p className="filter-summary">対象: {filterLabel}</p>
          <div className="period-selector" aria-label="表示期間">
            <span>期間</span>
            {PERIODS.map((item) => (
              <button
                key={item.months}
                className={`period-btn ${period === item.months ? "active" : ""}`}
                onClick={() => setFilter("period", String(item.months))}
                aria-pressed={period === item.months}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : !hasData ? (
        <div className="empty-panel">
          <p>選択した条件にデータがありません。</p>
          <p className="empty-state-note">
            条件を変更するか、「残高入力」で月次残高を登録してください。
          </p>
        </div>
      ) : (
        <>
          <section className="forecast-panel" aria-labelledby="forecast-title">
            <div className="forecast-header">
              <div>
                <h2 id="forecast-title">資産予測</h2>
                <p>直近の月平均増減を、そのまま将来へ延長します。</p>
              </div>
              <button
                className={`btn ${showProjection ? "btn-secondary" : "btn-primary"}`}
                onClick={() => setShowProjection((current) => !current)}
                disabled={!projection}
                aria-pressed={showProjection}
              >
                {showProjection ? "予測を隠す" : "予測を表示"}
              </button>
            </div>

            {!projection ? (
              <p className="forecast-unavailable">
                予測には異なる月の実績が2件以上必要です。
              </p>
            ) : showProjection ? (
              <>
                <div className="forecast-period-selector" aria-label="予測する期間">
                  {FORECAST_OPTIONS.map((item) => (
                    <button
                      key={item.months}
                      className={`period-btn ${forecastMonths === item.months ? "active" : ""}`}
                      onClick={() => setForecastMonths(item.months)}
                      aria-pressed={forecastMonths === item.months}
                    >
                      {item.label}後
                    </button>
                  ))}
                </div>

                <div className="forecast-result">
                  <div className="forecast-result-main">
                    <span className="forecast-result-label">
                      {formatMonthLabel(
                        projection.points[projection.points.length - 1].month
                      )}
                      の予測
                    </span>
                    <strong>{formatMoney(projection.projectedBalance)}</strong>
                    <span className={projection.difference >= 0 ? "positive" : "negative"}>
                      現在との差 {projection.difference >= 0 ? "+" : ""}
                      {formatMoney(projection.difference)}
                    </span>
                  </div>
                  <dl className="forecast-basis">
                    <div>
                      <dt>現在</dt>
                      <dd>{formatMoney(projection.currentBalance)}</dd>
                    </div>
                    <div>
                      <dt>月平均の増減</dt>
                      <dd className={projection.monthlyChange >= 0 ? "positive" : "negative"}>
                        {projection.monthlyChange >= 0 ? "+" : ""}
                        {formatMoney(Math.round(projection.monthlyChange))}
                      </dd>
                    </div>
                  </dl>
                </div>

                <p className="forecast-note">
                  {formatMonthLabel(projection.basisFrom)}〜
                  {formatMonthLabel(projection.basisTo)}の{projection.basisMonths}か月間を基準にした
                  単純予測です。利率や相場変動は考慮していません。
                  {projection.pointStepMonths > 1 && "グラフの予測線は1年ごとの点で描いています。"}
                  {projection.forecastMonths >= 120 &&
                    "期間が長いほど基準期間のブレがそのまま拡大するため、目安として見てください。"}
                </p>
              </>
            ) : null}
          </section>

          <div className="chart-section">
            <h2>{filterLabel}の推移</h2>
            <div className="chart-surface">
              <TotalAssetLineChart
                data={monthlyTotal}
                projection={showProjection ? projection?.points : undefined}
              />
            </div>
          </div>

          {!assetId && hasFilter && (
            <div className="chart-section">
              <h2>口座・資産別の推移</h2>
              <div className="chart-surface">
                <AssetLineChart data={assetData} />
              </div>
            </div>
          )}

          {!categoryId && !assetId && (
            <>
              <div className="chart-section">
                <h2>カテゴリ別推移</h2>
                <div className="chart-surface">
                  <CategoryLineChart data={categoryData} categories={visibleCategories} />
                </div>
              </div>

              <div className="chart-section">
                <h2>カテゴリ別内訳</h2>
                <div className="chart-surface">
                  <CategoryStackedBarChart
                    data={categoryData}
                    categories={visibleCategories}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
