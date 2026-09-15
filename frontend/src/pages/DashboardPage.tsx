import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyticsApi } from "../api/client";
import type { AssetTotal, Dashboard } from "../types";
import { getAssetCategoryColor } from "../design/theme";
import { formatMoney, formatMonthLabel } from "../utils/format";

function getShare(value: string, total: string): number {
  const totalValue = Number(total);
  if (totalValue <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(value) / totalValue) * 100));
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [assetTotals, setAssetTotals] = useState<AssetTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsApi
      .dashboard()
      .then(async (dashboard) => {
        const latestAssets = dashboard.latest_month
          ? await analyticsApi.byAsset({
              month_from: dashboard.latest_month,
              month_to: dashboard.latest_month,
            })
          : [];
        return { dashboard, latestAssets };
      })
      .then(({ dashboard, latestAssets }) => {
        setData(dashboard);
        setAssetTotals(latestAssets);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (error) return <div className="error-message">{error}</div>;

  if (!data?.latest_month) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty-state">
          <div>
            <h2>残高データがありません</h2>
            <p>資産を登録したあと、残高を入力してください。</p>
          </div>
          <div className="dashboard-empty-actions">
            <Link to="/assets" className="dashboard-text-link">
              資産を登録する
            </Link>
            <Link to="/snapshots" className="dashboard-primary-action">
              残高を入力する
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const diff = Number(data.prev_diff);
  const rate = data.prev_rate;
  const latestMonthLabel = formatMonthLabel(data.latest_month);
  const hasPreviousChange = diff !== 0;
  const assetsByCategory = new Map<string, AssetTotal[]>();
  assetTotals.forEach((asset) => {
    const categoryAssets = assetsByCategory.get(asset.category_name) ?? [];
    categoryAssets.push(asset);
    assetsByCategory.set(asset.category_name, categoryAssets);
  });
  const categoryRows = data.by_category.map((category) => ({
    ...category,
    share: getShare(category.total, data.total),
    color: getAssetCategoryColor(category.category_name, category.category_id),
    assets: (assetsByCategory.get(category.category_name) ?? []).sort(
      (left, right) => Number(right.total) - Number(left.total)
    ),
  }));

  return (
    <div className="dashboard-page">
      <section className="dashboard-summary" aria-labelledby="dashboard-total-label">
        <div className="dashboard-summary-main">
          <p id="dashboard-total-label" className="dashboard-summary-label">
            総資産
            <span>{latestMonthLabel}時点</span>
          </p>
          <p className="dashboard-total">{formatMoney(data.total)}</p>
          {hasPreviousChange ? (
            <p className={`dashboard-change ${diff >= 0 ? "is-positive" : "is-negative"}`}>
              {`前月比 ${diff >= 0 ? "+" : ""}${formatMoney(data.prev_diff)}（${
                diff >= 0 ? "+" : ""
              }${rate.toFixed(1)}%）`}
            </p>
          ) : (
            <p className="dashboard-change is-neutral">前月比 変化なし</p>
          )}
        </div>
        {Number(data.total) > 0 && categoryRows.length > 0 && (
          <div className="dashboard-composition" aria-hidden="true">
            {categoryRows.map((category) => (
              <span
                key={category.category_id}
                style={{
                  backgroundColor: category.color,
                  flexGrow: category.share,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-breakdown-grid">
        {categoryRows.length > 0 && (
          <section className="dashboard-breakdown" aria-labelledby="category-breakdown-title">
            <div className="dashboard-section-header">
              <h2 id="category-breakdown-title">カテゴリ別</h2>
            </div>
            <ul className="dashboard-category-list">
              {categoryRows.map((category) => (
                <li key={category.category_id}>
                  {category.assets.length > 0 ? (
                    <details className="dashboard-category-details">
                      <summary>
                        <span className="dashboard-category-summary-main">
                          <span className="dashboard-breakdown-row">
                            <span className="dashboard-category-name">
                              <span
                                className="dashboard-category-swatch"
                                style={{ backgroundColor: category.color }}
                                aria-hidden="true"
                              />
                              {category.category_name}
                            </span>
                            <span className="dashboard-breakdown-amount">
                              {formatMoney(category.total)}
                              <small>{category.share.toFixed(0)}%</small>
                            </span>
                          </span>
                          <span className="dashboard-share-track" aria-hidden="true">
                            <span
                              style={{
                                backgroundColor: category.color,
                                width: `${category.share}%`,
                              }}
                            />
                          </span>
                        </span>
                        <span className="dashboard-category-toggle">
                          内訳 {category.assets.length}件
                        </span>
                      </summary>
                      <ul className="dashboard-asset-list">
                        {category.assets.map((asset) => (
                          <li key={asset.asset_id}>
                            <span>
                              <strong>{asset.asset_name}</strong>
                              <small>{asset.owner_name}</small>
                            </span>
                            <strong>{formatMoney(asset.total)}</strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <>
                      <div className="dashboard-breakdown-row">
                        <span className="dashboard-category-name">
                          <span
                            className="dashboard-category-swatch"
                            style={{ backgroundColor: category.color }}
                            aria-hidden="true"
                          />
                          {category.category_name}
                        </span>
                        <span className="dashboard-breakdown-amount">
                          {formatMoney(category.total)}
                          <small>{category.share.toFixed(0)}%</small>
                        </span>
                      </div>
                      <div className="dashboard-share-track" aria-hidden="true">
                        <span
                          style={{
                            backgroundColor: category.color,
                            width: `${category.share}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.by_owner.length > 0 && (
          <section className="dashboard-breakdown" aria-labelledby="owner-breakdown-title">
            <div className="dashboard-section-header">
              <h2 id="owner-breakdown-title">名義人別</h2>
            </div>
            <ul className="dashboard-owner-list">
              {data.by_owner.map((owner) => (
                <li key={owner.owner_id}>
                  <div>
                    <span>{owner.owner_name}</span>
                  </div>
                  <small>{getShare(owner.total, data.total).toFixed(0)}%</small>
                  <strong>{formatMoney(owner.total)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
