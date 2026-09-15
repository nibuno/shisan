import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { snapshotsApi } from "../../api/client";
import type { SnapshotBulkRow } from "../../types";
import { formatMoney, formatMonthLabel } from "../../utils/format";

type ParsedBalance =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "valid"; normalized: string; value: number };

const balanceFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-01`;
}

function parseBalance(raw: string): ParsedBalance {
  const compact = raw
    .trim()
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0)
    )
    .replace(/，/g, ",")
    .replace(/[\s\u3000]/g, "");

  if (compact === "") return { kind: "empty" };

  const digits = compact.replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return { kind: "invalid" };

  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return { kind: "invalid" };

  return { kind: "valid", normalized: String(value), value };
}

function formatBalanceInput(value: string | number): string {
  return balanceFormatter.format(Number(value));
}

function isRecordedValue(row: SnapshotBulkRow, value: number): boolean {
  return row.current_balance !== null && Number(row.current_balance) === value;
}

export default function BulkSnapshotEntry({ onSaved }: { onSaved?: () => void }) {
  const [month, setMonth] = useState(currentMonthStart);
  const [rows, setRows] = useState<SnapshotBulkRow[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    setSaved("");
    snapshotsApi
      .bulkRows(month)
      .then((list) => {
        setRows(list);
        // Seed only from what is already recorded for this month. The previous
        // month is shown as a reference but never pre-filled: saving a stale
        // figure as this month's balance would quietly falsify the history.
        setValues(
          Object.fromEntries(
            list
              .filter((row) => row.current_balance !== null)
              .map((row) => [
                row.asset_id,
                formatBalanceInput(row.current_balance ?? "0"),
              ])
          )
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const parsedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        parsed: parseBalance(values[row.asset_id] ?? ""),
      })),
    [rows, values]
  );

  const parsedByAssetId = useMemo(
    () => new Map(parsedRows.map((item) => [item.row.asset_id, item.parsed])),
    [parsedRows]
  );

  const entries = useMemo(
    () =>
      parsedRows.flatMap((item) =>
        item.parsed.kind === "valid"
          ? [{ row: item.row, parsed: item.parsed }]
          : []
      ),
    [parsedRows]
  );

  const dirtyEntries = useMemo(
    () =>
      entries.filter(
        (item) => !isRecordedValue(item.row, item.parsed.value)
      ),
    [entries]
  );

  const invalidRows = useMemo(
    () => parsedRows.filter((item) => item.parsed.kind === "invalid"),
    [parsedRows]
  );

  const total = useMemo(
    () => entries.reduce((sum, item) => sum + item.parsed.value, 0),
    [entries]
  );

  const ownerGroups = useMemo(() => {
    const groupedRows = new Map<string, SnapshotBulkRow[]>();

    rows.forEach((row) => {
      const ownerRows = groupedRows.get(row.owner_name) ?? [];
      ownerRows.push(row);
      groupedRows.set(row.owner_name, ownerRows);
    });

    return Array.from(groupedRows, ([ownerName, ownerRows]) => ({
      ownerName,
      rows: ownerRows,
    }));
  }, [rows]);

  const handleValueChange = (assetId: number, value: string) => {
    setValues((previous) => ({ ...previous, [assetId]: value }));
    setError("");
    setSaved("");
  };

  const handleInputFocus = (assetId: number) => {
    const parsed = parseBalance(values[assetId] ?? "");
    if (parsed.kind === "valid") {
      setValues((previous) => ({
        ...previous,
        [assetId]: parsed.normalized,
      }));
    }
  };

  const handleInputBlur = (assetId: number) => {
    const parsed = parseBalance(values[assetId] ?? "");
    if (parsed.kind === "valid") {
      setValues((previous) => ({
        ...previous,
        [assetId]: formatBalanceInput(parsed.value),
      }));
    }
  };

  const handleSave = async () => {
    if (invalidRows.length > 0) {
      const firstInvalidRow = invalidRows[0].row;
      setError(`${firstInvalidRow.asset_name}の残高を数字で入力してください`);
      inputRefs.current[firstInvalidRow.asset_id]?.focus();
      return;
    }

    if (dirtyEntries.length === 0) return;

    setSaving(true);
    setError("");
    setSaved("");

    const entriesToSave = dirtyEntries.map((item) => ({
      asset_id: item.row.asset_id,
      balance: item.parsed.normalized,
    }));

    try {
      await snapshotsApi.bulkUpsert({ month, entries: entriesToSave });

      const savedBalances = new Map(
        dirtyEntries.map((item) => [
          item.row.asset_id,
          item.parsed.normalized,
        ])
      );

      const updatedRows = rows.map((row) => ({
        ...row,
        current_balance:
          savedBalances.get(row.asset_id) ?? row.current_balance,
      }));

      setRows(updatedRows);
      setValues(
        Object.fromEntries(
          updatedRows
            .filter((row) => row.current_balance !== null)
            .map((row) => [
              row.asset_id,
              formatBalanceInput(row.current_balance ?? "0"),
            ])
        )
      );
      setSaved("保存しました");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  const saveButtonLabel = saving
    ? "保存中…"
    : invalidRows.length > 0
      ? "入力内容を確認"
      : dirtyEntries.length > 0
        ? `${dirtyEntries.length}件を保存`
        : "保存";

  const saveStateLabel = saved
    ? saved
    : invalidRows.length > 0
      ? `${invalidRows.length}件の入力を確認してください`
      : dirtyEntries.length > 0
        ? `未保存 ${dirtyEntries.length}件`
        : "";

  const renderRow = (row: SnapshotBulkRow) => {
    const parsed = parsedByAssetId.get(row.asset_id) ?? {
      kind: "empty" as const,
    };
    const isInvalid = parsed.kind === "invalid";
    const clearedRecordedValue =
      parsed.kind === "empty" && row.current_balance !== null;
    const inputId = `bulk-balance-${row.asset_id}`;
    const feedbackId = `bulk-balance-feedback-${row.asset_id}`;
    const feedback = isInvalid
      ? "数字とカンマだけで入力してください"
      : clearedRecordedValue
        ? "空欄では記録済みの残高を変更しません"
        : "";
    const previousLabel = row.previous_month
      ? `${formatMonthLabel(row.previous_month)}の残高`
      : "前回の残高";

    return (
      <div
        key={row.asset_id}
        className={`bulk-row${isInvalid ? " has-error" : ""}`}
        role="listitem"
      >
        <div className="bulk-asset">
          <span className="bulk-asset-name">{row.asset_name}</span>
          <span className="bulk-asset-meta">{row.category_name}</span>
        </div>
        <span className="bulk-previous" aria-label={previousLabel}>
          {row.previous_balance === null
            ? "—"
            : formatMoney(row.previous_balance)}
        </span>
        <div className="bulk-entry-field">
          <div
            className={`bulk-input-field${isInvalid ? " is-invalid" : ""}`}
          >
            <input
              id={inputId}
              ref={(element) => {
                inputRefs.current[row.asset_id] = element;
              }}
              className="bulk-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="金額を入力"
              aria-label={`${row.asset_name}の${formatMonthLabel(month)}の残高`}
              aria-invalid={isInvalid}
              aria-describedby={feedback ? feedbackId : undefined}
              disabled={saving}
              value={values[row.asset_id] ?? ""}
              onChange={(event) =>
                handleValueChange(row.asset_id, event.target.value)
              }
              onFocus={() => handleInputFocus(row.asset_id)}
              onBlur={() => handleInputBlur(row.asset_id)}
            />
            <span className="bulk-input-unit" aria-hidden="true">
              円
            </span>
          </div>
          {feedback && (
            <span
              id={feedbackId}
              className={`bulk-input-feedback${isInvalid ? " is-error" : ""}`}
              aria-live="polite"
            >
              {feedback}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  return (
    <div className="bulk-entry">
      <div className="bulk-month-nav">
        <button
          type="button"
          className="bulk-month-step"
          aria-label={`${formatMonthLabel(shiftMonth(month, -1))}へ`}
          disabled={saving}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <span aria-hidden="true">←</span> 前月
        </button>
        <div className="bulk-month-heading">
          <h2>{formatMonthLabel(month)}</h2>
        </div>
        <button
          type="button"
          className="bulk-month-step bulk-month-step-next"
          aria-label={`${formatMonthLabel(shiftMonth(month, 1))}へ`}
          disabled={saving}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          翌月 <span aria-hidden="true">→</span>
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="empty-state">
          資産が登録されていません。先に「資産管理」から登録してください。
        </p>
      ) : (
        <>
          <div
            className={`bulk-owner-groups${ownerGroups.length === 1 ? " is-single" : ""}`}
            aria-describedby="bulk-entry-note"
          >
            {ownerGroups.map((group) => {
              const headingId = `bulk-owner-${group.rows[0].asset_id}`;

              return (
                <section
                  key={group.ownerName}
                  className="bulk-owner-group"
                  aria-labelledby={headingId}
                >
                  <div className="bulk-owner-heading">
                    <h3 id={headingId}>{group.ownerName}</h3>
                    <span>{group.rows.length}件</span>
                  </div>
                  <div className="bulk-column-head" aria-hidden="true">
                    <span>資産</span>
                    <span>前回</span>
                    <span>{formatMonthLabel(month)}末の残高</span>
                  </div>
                  <div
                    className="bulk-list"
                    role="list"
                    aria-label={`${group.ownerName}の資産`}
                  >
                    {group.rows.map(renderRow)}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="bulk-footer">
            <div className="bulk-total">
              <span className="bulk-total-label">入力合計</span>
              <strong className="bulk-total-value">
                {entries.length > 0 ? formatMoney(total) : "—"}
              </strong>
              <span className="bulk-total-count">
                {entries.length} / {rows.length}件
              </span>
            </div>
            <div className="bulk-save-area">
              <span
                className={`bulk-save-state${invalidRows.length > 0 ? " has-error" : ""}${saved ? " is-saved" : ""}`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {saveStateLabel}
              </span>
              <button
                type="button"
                className="btn btn-primary bulk-save-button"
                onClick={handleSave}
                disabled={
                  saving ||
                  (invalidRows.length === 0 && dirtyEntries.length === 0)
                }
              >
                {saveButtonLabel}
              </button>
            </div>
          </div>
          <p className="bulk-note" id="bulk-entry-note">
            空欄は保存しません。0円を記録する場合は「0」と入力してください。
          </p>
        </>
      )}
    </div>
  );
}
