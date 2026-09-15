export interface Owner {
  id: number;
  name: string;
}

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface Category {
  id: number;
  name: string;
}

export interface Asset {
  id: number;
  owner: Owner;
  category: Category;
  name: string;
  purpose: string;
}

export interface BalanceSnapshot {
  id: number;
  asset_id: number;
  month: string; // "YYYY-MM-DD" (always first day)
  balance: string; // Decimal as string
}

export interface RecommendedSnapshotMonth {
  month: string;
}

export interface MonthlyTotal {
  month: string;
  total: string;
}

export interface CategoryTotal {
  month: string;
  category_id: number;
  category_name: string;
  total: string;
}

export interface OwnerTotal {
    month: string;
    owner_id: number;
    owner_name: string;
    total: string;
}

export interface AssetTotal {
  month: string;
  asset_id: number;
  asset_name: string;
  owner_name: string;
  category_name: string;
  total: string;
}

export interface Dashboard {
  latest_month: string;
  total: string;
  prev_diff: string;
  prev_rate: number;
  by_category: CategoryTotal[];
  by_owner: OwnerTotal[];
}

export interface InvitationInfo {
  household_name: string;
}

export interface SnapshotBulkRow {
  asset_id: number;
  asset_name: string;
  owner_name: string;
  category_name: string;
  current_balance: string | null;
  previous_balance: string | null;
  previous_month: string | null;
}
