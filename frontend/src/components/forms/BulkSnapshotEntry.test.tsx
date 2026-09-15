import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { snapshotsApi } from "../../api/client";
import type { SnapshotBulkRow } from "../../types";
import BulkSnapshotEntry from "./BulkSnapshotEntry";

vi.mock("../../api/client", () => ({
  snapshotsApi: {
    bulkRows: vi.fn(),
    bulkUpsert: vi.fn(),
  },
}));

const rows: SnapshotBulkRow[] = [
  {
    asset_id: 1,
    asset_name: "生活費口座",
    owner_name: "サンプル太郎",
    category_name: "銀行",
    current_balance: null,
    previous_balance: "348200",
    previous_month: "2026-07-01",
  },
];

describe("BulkSnapshotEntry", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(snapshotsApi.bulkRows).mockResolvedValue(rows);
    vi.mocked(snapshotsApi.bulkUpsert).mockResolvedValue([]);
  });

  it("explains invalid text without silently disabling the action", async () => {
    render(<BulkSnapshotEntry />);

    const input = await screen.findByLabelText(/生活費口座の.+の残高/);
    fireEvent.change(input, { target: { value: "abc" } });

    expect(
      screen.getByText("数字とカンマだけで入力してください")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "入力内容を確認" })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "生活費口座の残高を数字で入力してください"
    );
    expect(input).toHaveFocus();
    expect(snapshotsApi.bulkUpsert).not.toHaveBeenCalled();
  });

  it("accepts full-width digits and keeps save feedback until the next edit", async () => {
    const onSaved = vi.fn();
    render(<BulkSnapshotEntry onSaved={onSaved} />);

    const input = await screen.findByLabelText(/生活費口座の.+の残高/);
    fireEvent.change(input, { target: { value: "１２３，４５６" } });

    expect(screen.getByRole("status")).toHaveTextContent("未保存 1件");
    expect(screen.getByText("￥123,456")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1件を保存" }));

    await waitFor(() =>
      expect(snapshotsApi.bulkUpsert).toHaveBeenCalledWith({
        month: expect.stringMatching(/^\d{4}-\d{2}-01$/),
        entries: [{ asset_id: 1, balance: "123456" }],
      })
    );

    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("保存しました");
    expect(input).toHaveValue("123,456");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "123457" } });

    expect(screen.getByRole("status")).toHaveTextContent("未保存 1件");
    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
  });

  it("groups compact input rows by owner", async () => {
    vi.mocked(snapshotsApi.bulkRows).mockResolvedValue([
      rows[0],
      {
        ...rows[0],
        asset_id: 2,
        asset_name: "積立口座",
        owner_name: "サンプル花子",
        category_name: "NISA",
      },
    ]);

    render(<BulkSnapshotEntry />);

    const sampleTaroAssets = await screen.findByRole("list", {
      name: "サンプル太郎の資産",
    });
    const sampleHanakoAssets = screen.getByRole("list", { name: "サンプル花子の資産" });

    expect(
      within(sampleTaroAssets).getByRole("listitem")
    ).toHaveTextContent("生活費口座銀行");
    expect(within(sampleHanakoAssets).getByRole("listitem")).toHaveTextContent(
      "積立口座NISA"
    );
  });
});
