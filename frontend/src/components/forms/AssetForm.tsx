import { useState } from "react";
import type { Owner, Category } from "../../types";

interface AssetFormData {
  name: string;
  purpose: string;
  owner_id: number;
  category_id: number;
}

interface AssetFormProps {
  owners: Owner[];
  categories: Category[];
  initial?: Partial<AssetFormData>;
  onSubmit: (data: AssetFormData) => Promise<void>;
  onClose: () => void;
}

export default function AssetForm({
  owners,
  categories,
  initial,
  onSubmit,
  onClose,
}: AssetFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [ownerId, setOwnerId] = useState<number>(
    initial?.owner_id ?? owners[0]?.id ?? 0
  );
  const [categoryId, setCategoryId] = useState<number>(
    initial?.category_id ?? categories[0]?.id ?? 0
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("資産名を入力してください");
      return;
    }
    if (!ownerId || !categoryId) {
      setError("名義人とカテゴリを選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), purpose: purpose.trim(), owner_id: ownerId, category_id: categoryId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="asset-name">資産名</label>
        <input
          id="asset-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: SBIネット銀行"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="asset-owner">名義人</label>
        <select id="asset-owner" value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="asset-category">カテゴリ</label>
        <select id="asset-category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="asset-purpose">用途 <span>任意</span></label>
        <input
          id="asset-purpose"
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="例: 生活費用口座"
        />
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          キャンセル
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}
