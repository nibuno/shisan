import { useEffect, useState } from "react";
import type { Asset } from "../../types";

interface SnapshotFormData {
  asset_id: number;
  month: string; // "YYYY-MM-01"
  balance: string;
}

interface SnapshotFormProps {
  assets: Asset[];
  initial?: { asset_id?: number; month?: string; balance?: string };
  onSubmit: (data: SnapshotFormData) => Promise<void>;
  onClose: () => void;
  getSuggestedMonth?: (assetId: number) => Promise<string>;
}

function toMonthInput(dateStr: string): string {
  // "2025-01-01" → "2025-01"
  return dateStr.slice(0, 7);
}

function toMonthFirst(monthInput: string): string {
  // "2025-01" → "2025-01-01"
  return `${monthInput}-01`;
}

function getCurrentMonthInput(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function SnapshotForm({
  assets,
  initial,
  onSubmit,
  onClose,
  getSuggestedMonth,
}: SnapshotFormProps) {
  const [assetId, setAssetId] = useState<number>(
    initial?.asset_id ?? assets[0]?.id ?? 0
  );
  const [month, setMonth] = useState(
    initial?.month ? toMonthInput(initial.month) : getCurrentMonthInput()
  );
  const [balance, setBalance] = useState(initial?.balance ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial?.month || !assetId || !getSuggestedMonth) return;

    let active = true;
    getSuggestedMonth(assetId)
      .then((suggestedMonth) => {
        if (active) setMonth(toMonthInput(suggestedMonth));
      })
      .catch(() => {
        if (active) setMonth(getCurrentMonthInput());
      });

    return () => {
      active = false;
    };
  }, [assetId, getSuggestedMonth, initial?.month]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId) {
      setError("資産を選択してください");
      return;
    }
    if (!month) {
      setError("年月を入力してください");
      return;
    }
    if (!balance || isNaN(Number(balance))) {
      setError("残高を正しく入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        asset_id: assetId,
        month: toMonthFirst(month),
        balance: balance,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="snapshot-asset">資産</label>
        <select id="snapshot-asset" value={assetId} onChange={(e) => setAssetId(Number(e.target.value))}>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}（{a.owner.name} / {a.category.name}）
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="snapshot-month">年月</label>
        <input
          id="snapshot-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="snapshot-balance">残高 <span>円</span></label>
        <input
          id="snapshot-balance"
          type="number"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="例: 1500000"
          min="0"
          step="1"
          required
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
