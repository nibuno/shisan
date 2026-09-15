import { useEffect, useState, useCallback } from "react";
import { assetsApi, snapshotsApi } from "../api/client";
import type { Asset, BalanceSnapshot } from "../types";
import BulkSnapshotEntry from "../components/forms/BulkSnapshotEntry";
import SnapshotForm from "../components/forms/SnapshotForm";
import Modal from "../components/layout/Modal";
import { formatMoney, formatMonthLabel } from "../utils/format";

export default function SnapshotsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [snapshots, setSnapshots] = useState<BalanceSnapshot[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [mode, setMode] = useState<"bulk" | "single">("bulk");
  const [showModal, setShowModal] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<BalanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assetsApi
      .list()
      .then((list) => {
        setAssets(list);
        if (list.length > 0) setSelectedAssetId(list[0].id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchSnapshots = useCallback(() => {
    if (selectedAssetId === null) return;
    snapshotsApi
      .list({ asset_id: selectedAssetId })
      .then(setSnapshots)
      .catch((e: Error) => setError(e.message));
  }, [selectedAssetId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const handleDelete = async (snapshot: BalanceSnapshot) => {
    const label = formatMonthLabel(snapshot.month);
    if (!confirm(`${label} の残高を削除しますか？`)) return;
    try {
      await snapshotsApi.delete(snapshot.id);
      fetchSnapshots();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const handleFormSubmit = async (data: {
    asset_id: number;
    month: string;
    balance: string;
  }) => {
    if (editingSnapshot) {
      await snapshotsApi.update(editingSnapshot.id, { balance: data.balance });
    } else {
      await snapshotsApi.upsert(data);
    }
    setShowModal(false);
    setEditingSnapshot(null);
    fetchSnapshots();
  };

  const openAdd = () => {
    setEditingSnapshot(null);
    setShowModal(true);
  };

  const openEdit = (snapshot: BalanceSnapshot) => {
    setEditingSnapshot(snapshot);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSnapshot(null);
  };

  if (loading) return <div className="loading">読み込み中...</div>;

  if (assets.length === 0) {
    return (
      <div className="management-page">
        <div className="page-header">
          <h1>残高入力</h1>
        </div>
        <div className="empty-panel">
          <p>資産が登録されていません。先に「資産管理」で資産を登録してください。</p>
        </div>
      </div>
    );
  }

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <div className="management-page">
      <div className="snapshots-heading-row">
        <div className="page-header">
          <h1>残高入力</h1>
          {mode === "single" && (
            <button className="btn btn-primary" onClick={openAdd}>
              残高を記録
            </button>
          )}
        </div>

        <div className="mode-switch" role="tablist" aria-label="入力方法">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "bulk"}
            className={`mode-tab${mode === "bulk" ? " is-active" : ""}`}
            onClick={() => setMode("bulk")}
          >
            まとめて入力
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            className={`mode-tab${mode === "single" ? " is-active" : ""}`}
            onClick={() => setMode("single")}
          >
            資産ごとに見る
          </button>
        </div>
      </div>

      {mode === "bulk" && <BulkSnapshotEntry onSaved={fetchSnapshots} />}

      {error && (
        <div className="error-message" onClick={() => setError(null)}>
          {error}（クリックで閉じる）
        </div>
      )}

      {mode === "single" && (
      <>
      <div className="filter-bar">
        <label className="filter-field filter-field-wide">
          <span>資産</span>
          <select
            value={selectedAssetId ?? ""}
            onChange={(e) => setSelectedAssetId(Number(e.target.value))}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}（{a.owner.name} / {a.category.name}）
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedAsset && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>年月</th>
                <th className="amount-header">残高</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state">
                    残高の記録がありません
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="table-primary">{formatMonthLabel(s.month)}</td>
                    <td className="amount-cell">{formatMoney(s.balance)}</td>
                    <td>
                      <div className="action-cell">
                        <button
                          className="action-link"
                          onClick={() => openEdit(s)}
                        >
                          編集
                        </button>
                        <button
                          className="action-link action-link-danger"
                          onClick={() => handleDelete(s)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {showModal && (
        <Modal
          title={editingSnapshot ? "残高を編集" : "残高を記録"}
          onClose={closeModal}
        >
          <SnapshotForm
            assets={assets}
            initial={
              editingSnapshot
                ? {
                    asset_id: editingSnapshot.asset_id,
                    month: editingSnapshot.month,
                    balance: editingSnapshot.balance,
                  }
                : selectedAssetId
                ? { asset_id: selectedAssetId }
                : undefined
            }
            getSuggestedMonth={(assetId) =>
              snapshotsApi.recommendedMonth(assetId).then((result) => result.month)
            }
            onSubmit={handleFormSubmit}
            onClose={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}
