import { useEffect, useState, useCallback } from "react";
import { assetsApi, ownersApi, categoriesApi } from "../api/client";
import type { Asset, Owner, Category } from "../types";
import AssetForm from "../components/forms/AssetForm";
import Modal from "../components/layout/Modal";
import { getAssetCategoryColor } from "../design/theme";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterOwner, setFilterOwner] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(() => {
    const params: { owner_id?: number; category_id?: number } = {};
    if (filterOwner) params.owner_id = Number(filterOwner);
    if (filterCategory) params.category_id = Number(filterCategory);
    assetsApi.list(params).then(setAssets).catch((e: Error) => setError(e.message));
  }, [filterOwner, filterCategory]);

  useEffect(() => {
    ownersApi.list().then(setOwners).catch((e: Error) => setError(e.message));
    categoriesApi.list().then(setCategories).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`「${asset.name}」を削除しますか？\n関連する月次残高もすべて削除されます。`)) return;
    try {
      await assetsApi.delete(asset.id);
      fetchAssets();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const handleFormSubmit = async (data: {
    name: string;
    purpose: string;
    owner_id: number;
    category_id: number;
  }) => {
    if (editingAsset) {
      await assetsApi.update(editingAsset.id, data);
    } else {
      await assetsApi.create(data);
    }
    setShowModal(false);
    setEditingAsset(null);
    fetchAssets();
  };

  const openAdd = () => {
    setEditingAsset(null);
    setShowModal(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAsset(null);
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>資産管理</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          資産を追加
        </button>
      </div>

      {error && (
        <div className="error-message" onClick={() => setError(null)}>
          {error} （クリックで閉じる）
        </div>
      )}

      <div className="filter-bar" aria-label="資産の絞り込み">
        <label className="filter-field">
          <span>名義人</span>
          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)}>
            <option value="">すべて</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>カテゴリ</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">すべて</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>資産名</th>
              <th>カテゴリ</th>
              <th>名義人</th>
              <th>用途</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  資産が登録されていません
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="table-primary">{asset.name}</td>
                  <td>
                    <span className="category-label">
                      <span
                        className="category-swatch"
                        style={{
                          backgroundColor: getAssetCategoryColor(
                            asset.category.name,
                            asset.category.id
                          ),
                        }}
                        aria-hidden="true"
                      />
                      {asset.category.name}
                    </span>
                  </td>
                  <td>{asset.owner.name}</td>
                  <td className="table-muted">{asset.purpose || "—"}</td>
                  <td>
                    <div className="action-cell">
                      <button
                        className="action-link"
                        onClick={() => openEdit(asset)}
                      >
                        編集
                      </button>
                      <button
                        className="action-link action-link-danger"
                        onClick={() => handleDelete(asset)}
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

      {showModal && owners.length > 0 && categories.length > 0 && (
        <Modal
          title={editingAsset ? "資産を編集" : "資産を追加"}
          onClose={closeModal}
        >
          <AssetForm
            owners={owners}
            categories={categories}
            initial={
              editingAsset
                ? {
                    name: editingAsset.name,
                    purpose: editingAsset.purpose,
                    owner_id: editingAsset.owner.id,
                    category_id: editingAsset.category.id,
                  }
                : undefined
            }
            onSubmit={handleFormSubmit}
            onClose={closeModal}
          />
        </Modal>
      )}

      {showModal && (owners.length === 0 || categories.length === 0) && (
        <Modal title="資産を追加" onClose={closeModal}>
          <div className="empty-state">
            <p>資産を追加するには、先に名義人とカテゴリを登録する必要があります。</p>
            <p className="empty-state-note">
              起動直後はカテゴリのみ自動登録されます。名義人はAPIから登録してください。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
