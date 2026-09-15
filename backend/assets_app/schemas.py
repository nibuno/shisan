from datetime import date, datetime
from decimal import Decimal

from ninja import Schema


class LoginIn(Schema):
    username: str
    password: str


class SignupIn(Schema):
    username: str
    password: str
    household_name: str


class SnapshotBulkEntryIn(Schema):
    asset_id: int
    balance: Decimal


class SnapshotBulkIn(Schema):
    month: date
    entries: list[SnapshotBulkEntryIn]


class SnapshotBulkRowOut(Schema):
    asset_id: int
    asset_name: str
    owner_name: str
    category_name: str
    current_balance: Decimal | None = None
    previous_balance: Decimal | None = None
    previous_month: date | None = None


class InvitationCreateIn(Schema):
    role: str = "member"


class InvitationOut(Schema):
    id: int
    token: str
    role: str
    expires_at: datetime
    accepted_at: datetime | None = None


class InvitationInfoOut(Schema):
    household_name: str


class InvitationAcceptIn(Schema):
    username: str
    password: str


class UserOut(Schema):
    id: int
    username: str


class AuthStatusOut(Schema):
    authenticated: bool
    user: UserOut | None = None


class OwnerIn(Schema):
    name: str


class OwnerOut(Schema):
    id: int
    name: str


class CategoryIn(Schema):
    name: str


class CategoryOut(Schema):
    id: int
    name: str


class AssetIn(Schema):
    owner_id: int
    category_id: int
    name: str
    purpose: str = ""


class AssetOut(Schema):
    id: int
    owner: OwnerOut
    category: CategoryOut
    name: str
    purpose: str


class SnapshotIn(Schema):
    asset_id: int
    month: date
    balance: Decimal


class SnapshotUpdateIn(Schema):
    balance: Decimal


class SnapshotOut(Schema):
    id: int
    asset_id: int
    month: date
    balance: Decimal


class SnapshotRecommendedMonthOut(Schema):
    month: str


class MonthlyTotalOut(Schema):
    month: str
    total: Decimal


class CategoryTotalOut(Schema):
    month: str
    category_id: int
    category_name: str
    total: Decimal


class OwnerTotalOut(Schema):
    month: str
    owner_id: int
    owner_name: str
    total: Decimal


class AssetTotalOut(Schema):
    month: str
    asset_id: int
    asset_name: str
    owner_name: str
    category_name: str
    total: Decimal


class DashboardOut(Schema):
    latest_month: str
    total: Decimal
    prev_diff: Decimal
    prev_rate: float
    by_category: list[CategoryTotalOut]
    by_owner: list[OwnerTotalOut]


class ErrorOut(Schema):
    detail: str
