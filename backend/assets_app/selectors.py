from datetime import date
from decimal import Decimal
from typing import Optional

from django.db.models import QuerySet, Sum

from assets_app.models import Asset, BalanceSnapshot, Category, Household, Owner
from assets_app.months import month_start, next_month, previous_month


def owner_list(*, household: Household) -> QuerySet[Owner]:
    return Owner.objects.filter(household=household)


def owner_get(*, household: Household, owner_id: int) -> Owner:
    return Owner.objects.get(household=household, id=owner_id)


def category_list(*, household: Household) -> QuerySet[Category]:
    return Category.objects.filter(household=household)


def category_get(*, household: Household, category_id: int) -> Category:
    return Category.objects.get(household=household, id=category_id)


def asset_list(
    *,
    household: Household,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
) -> QuerySet[Asset]:
    qs = Asset.objects.select_related("owner", "category").filter(household=household)
    if owner_id is not None:
        qs = qs.filter(owner_id=owner_id)
    if category_id is not None:
        qs = qs.filter(category_id=category_id)
    return qs


def asset_get(*, household: Household, asset_id: int) -> Asset:
    return Asset.objects.select_related("owner", "category").get(
        household=household, id=asset_id
    )


def snapshot_list(
    *,
    household: Household,
    asset_id: Optional[int] = None,
    month_from: Optional[date] = None,
    month_to: Optional[date] = None,
) -> QuerySet[BalanceSnapshot]:
    qs = BalanceSnapshot.objects.select_related("asset").filter(
        asset__household=household
    )
    if asset_id is not None:
        qs = qs.filter(asset_id=asset_id)
    if month_from is not None:
        qs = qs.filter(month__gte=month_from)
    if month_to is not None:
        qs = qs.filter(month__lte=month_to)
    return qs


def snapshot_get(*, household: Household, snapshot_id: int) -> BalanceSnapshot:
    return BalanceSnapshot.objects.get(asset__household=household, id=snapshot_id)


def _snapshot_months_for_asset(*, asset: Asset) -> set[date]:
    """Private: the caller must already hold a household-scoped asset."""
    return set(
        BalanceSnapshot.objects.filter(asset=asset).values_list("month", flat=True)
    )


def snapshot_earliest_month(*, household: Household) -> Optional[date]:
    return (
        BalanceSnapshot.objects.filter(asset__household=household)
        .order_by("month")
        .values_list("month", flat=True)
        .first()
    )


def snapshot_recommended_month_for_asset(
    *, household: Household, asset_id: int, today: Optional[date] = None
) -> date:
    asset = asset_get(household=household, asset_id=asset_id)
    current_month = month_start(today or date.today())
    asset_months = _snapshot_months_for_asset(asset=asset)

    if not asset_months:
        return snapshot_earliest_month(household=household) or current_month

    cursor = min(asset_months)
    while cursor <= current_month:
        if cursor not in asset_months:
            return cursor
        cursor = next_month(cursor)

    return current_month


def snapshot_bulk_entry_rows(*, household: Household, month: date) -> list[dict]:
    """One row per asset for a month: what is recorded, and what came before.

    The previous value is only ever shown as a reference. Pre-filling it would
    let a stale figure be saved as this month's real balance.
    """
    assets = (
        Asset.objects.select_related("owner", "category")
        .filter(household=household)
        .order_by("owner__id", "category__id", "id")
    )
    current = {
        snapshot.asset_id: snapshot.balance
        for snapshot in BalanceSnapshot.objects.filter(
            asset__household=household, month=month
        )
    }

    previous: dict[int, BalanceSnapshot] = {}
    for snapshot in BalanceSnapshot.objects.filter(
        asset__household=household, month__lt=month
    ).order_by("asset_id", "-month"):
        previous.setdefault(snapshot.asset_id, snapshot)

    rows = []
    for asset in assets:
        earlier = previous.get(asset.id)
        rows.append(
            {
                "asset_id": asset.id,
                "asset_name": asset.name,
                "owner_name": asset.owner.name,
                "category_name": asset.category.name,
                "current_balance": current.get(asset.id),
                "previous_balance": earlier.balance if earlier else None,
                "previous_month": earlier.month if earlier else None,
            }
        )
    return rows


def filtered_snapshots(
    *,
    household: Household,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
) -> QuerySet[BalanceSnapshot]:
    qs = BalanceSnapshot.objects.filter(
        asset__household=household,
        month__gte=month_from,
        month__lte=month_to,
    )
    if owner_id is not None:
        qs = qs.filter(asset__owner_id=owner_id)
    if category_id is not None:
        qs = qs.filter(asset__category_id=category_id)
    if asset_id is not None:
        qs = qs.filter(asset_id=asset_id)
    return qs


def monthly_totals(
    *,
    household: Household,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
) -> QuerySet[dict]:
    return (
        filtered_snapshots(
            household=household,
            month_from=month_from,
            month_to=month_to,
            owner_id=owner_id,
            category_id=category_id,
            asset_id=asset_id,
        )
        .values("month")
        .annotate(total=Sum("balance"))
        .order_by("month")
    )


def category_totals(
    *,
    household: Household,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
) -> QuerySet[dict]:
    return (
        filtered_snapshots(
            household=household,
            month_from=month_from,
            month_to=month_to,
            owner_id=owner_id,
            category_id=category_id,
            asset_id=asset_id,
        )
        .values("month", "asset__category__id", "asset__category__name")
        .annotate(total=Sum("balance"))
        .order_by("month", "asset__category__id")
    )


def owner_totals(
    *,
    household: Household,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
) -> QuerySet[dict]:
    return (
        filtered_snapshots(
            household=household,
            month_from=month_from,
            month_to=month_to,
            owner_id=owner_id,
            category_id=category_id,
            asset_id=asset_id,
        )
        .values("month", "asset__owner__id", "asset__owner__name")
        .annotate(total=Sum("balance"))
        .order_by("month", "asset__owner__id")
    )


def asset_totals(
    *,
    household: Household,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
) -> QuerySet[dict]:
    return (
        filtered_snapshots(
            household=household,
            month_from=month_from,
            month_to=month_to,
            owner_id=owner_id,
            category_id=category_id,
            asset_id=asset_id,
        )
        .values(
            "month",
            "asset__id",
            "asset__name",
            "asset__owner__name",
            "asset__category__name",
        )
        .annotate(total=Sum("balance"))
        .order_by("month", "asset__id")
    )


def latest_snapshot_month(*, household: Household) -> Optional[date]:
    return (
        BalanceSnapshot.objects.filter(asset__household=household)
        .order_by("-month")
        .values_list("month", flat=True)
        .first()
    )


def snapshot_total_for_month(*, household: Household, month: date) -> Decimal:
    return (
        BalanceSnapshot.objects.filter(
            asset__household=household, month=month
        ).aggregate(total=Sum("balance"))["total"]
        or Decimal("0")
    )


def category_totals_for_month(*, household: Household, month: date) -> QuerySet[dict]:
    return (
        BalanceSnapshot.objects.filter(asset__household=household, month=month)
        .values("asset__category__id", "asset__category__name")
        .annotate(total=Sum("balance"))
        .order_by("asset__category__id")
    )


def owner_totals_for_month(*, household: Household, month: date) -> QuerySet[dict]:
    return (
        BalanceSnapshot.objects.filter(asset__household=household, month=month)
        .values("asset__owner__id", "asset__owner__name")
        .annotate(total=Sum("balance"))
        .order_by("asset__owner__id")
    )


def dashboard_data(*, household: Household) -> dict:
    latest_month = latest_snapshot_month(household=household)
    if latest_month is None:
        return {
            "latest_month": None,
            "total": Decimal("0"),
            "prev_diff": Decimal("0"),
            "prev_rate": 0.0,
            "by_category": [],
            "by_owner": [],
        }

    total = snapshot_total_for_month(household=household, month=latest_month)
    prev_total = snapshot_total_for_month(
        household=household, month=previous_month(latest_month)
    )
    prev_diff = total - prev_total

    return {
        "latest_month": latest_month,
        "total": total,
        "prev_diff": prev_diff,
        "prev_rate": float(prev_diff / prev_total * 100) if prev_total else 0.0,
        "by_category": category_totals_for_month(
            household=household, month=latest_month
        ),
        "by_owner": owner_totals_for_month(household=household, month=latest_month),
    }
