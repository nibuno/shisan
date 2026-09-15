import type {
  Owner,
  Category,
  Asset,
  BalanceSnapshot,
  RecommendedSnapshotMonth,
  MonthlyTotal,
  CategoryTotal,
  OwnerTotal,
  AssetTotal,
  Dashboard,
  AuthStatus,
  InvitationInfo,
  SnapshotBulkRow,
} from "../types";

const BASE = "/api";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "TRACE"];

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function getCookie(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!SAFE_METHODS.includes(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, body.detail || `エラーが発生しました (${res.status})`, body);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data) });
const put = <T>(path: string, data: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(data) });
const del = (path: string) => request<unknown>(path, { method: "DELETE" });

export const authApi = {
  csrf: () => get<AuthStatus>("/auth/csrf/"),
  me: () => get<AuthStatus>("/auth/me/"),
  login: (data: { username: string; password: string }) =>
    post<AuthStatus>("/auth/login/", data),
  invitationInfo: (token: string) =>
    get<InvitationInfo>(`/auth/invitation/${encodeURIComponent(token)}/`),
  acceptInvitation: (
    token: string,
    data: { username: string; password: string }
  ) =>
    post<AuthStatus>(
      `/auth/invitation/${encodeURIComponent(token)}/accept/`,
      data
    ),
  logout: () => post<AuthStatus>("/auth/logout/", {}),
};

export const ownersApi = {
  list: () => get<Owner[]>("/owners/"),
  create: (data: { name: string }) => post<Owner>("/owners/", data),
  update: (id: number, data: { name: string }) => put<Owner>(`/owners/${id}`, data),
  delete: (id: number) => del(`/owners/${id}`),
};

export const categoriesApi = {
  list: () => get<Category[]>("/categories/"),
  create: (data: { name: string }) => post<Category>("/categories/", data),
  update: (id: number, data: { name: string }) => put<Category>(`/categories/${id}`, data),
  delete: (id: number) => del(`/categories/${id}`),
};

export const assetsApi = {
  list: (params?: { owner_id?: number; category_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.owner_id) q.set("owner_id", String(params.owner_id));
    if (params?.category_id) q.set("category_id", String(params.category_id));
    const qs = q.toString();
    return get<Asset[]>(`/assets/${qs ? "?" + qs : ""}`);
  },
  create: (data: { name: string; purpose: string; owner_id: number; category_id: number }) =>
    post<Asset>("/assets/", data),
  update: (
    id: number,
    data: { name: string; purpose: string; owner_id: number; category_id: number }
  ) => put<Asset>(`/assets/${id}`, data),
  delete: (id: number) => del(`/assets/${id}`),
};

export const snapshotsApi = {
  bulkRows: (month: string) =>
    get<SnapshotBulkRow[]>(`/snapshots/bulk/?month=${encodeURIComponent(month)}`),
  bulkUpsert: (data: {
    month: string;
    entries: { asset_id: number; balance: string }[];
  }) => post<BalanceSnapshot[]>("/snapshots/bulk/", data),
  list: (params?: { asset_id?: number; month_from?: string; month_to?: string }) => {
    const q = new URLSearchParams();
    if (params?.asset_id) q.set("asset_id", String(params.asset_id));
    if (params?.month_from) q.set("month_from", params.month_from);
    if (params?.month_to) q.set("month_to", params.month_to);
    const qs = q.toString();
    return get<BalanceSnapshot[]>(`/snapshots/${qs ? "?" + qs : ""}`);
  },
  upsert: (data: { asset_id: number; month: string; balance: string }) =>
    post<BalanceSnapshot>("/snapshots/", data),
  recommendedMonth: (assetId: number) =>
    get<RecommendedSnapshotMonth>(`/snapshots/recommended-month/?asset_id=${assetId}`),
  update: (id: number, data: { balance: string }) =>
    put<BalanceSnapshot>(`/snapshots/${id}`, data),
  delete: (id: number) => del(`/snapshots/${id}`),
};

interface AnalyticsParams {
  month_from: string;
  month_to: string;
  owner_id?: number;
  category_id?: number;
  asset_id?: number;
}

function analyticsQuery(params: AnalyticsParams): string {
  const query = new URLSearchParams({
    month_from: params.month_from,
    month_to: params.month_to,
  });
  if (params.owner_id) query.set("owner_id", String(params.owner_id));
  if (params.category_id) query.set("category_id", String(params.category_id));
  if (params.asset_id) query.set("asset_id", String(params.asset_id));
  return query.toString();
}

export const analyticsApi = {
  monthlyTotal: (params: AnalyticsParams) => {
    return get<MonthlyTotal[]>(`/analytics/monthly-total/?${analyticsQuery(params)}`);
  },
  byCategory: (params: AnalyticsParams) => {
    return get<CategoryTotal[]>(`/analytics/by-category/?${analyticsQuery(params)}`);
  },
  byOwner: (params: AnalyticsParams) => {
    return get<OwnerTotal[]>(`/analytics/by-owner/?${analyticsQuery(params)}`);
  },
  byAsset: (params: AnalyticsParams) => {
    return get<AssetTotal[]>(`/analytics/by-asset/?${analyticsQuery(params)}`);
  },
  dashboard: () => get<Dashboard>("/analytics/dashboard/"),
};
