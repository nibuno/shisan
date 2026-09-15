from datetime import date
from decimal import Decimal
from typing import Optional

from ninja import Router

from assets_app.schemas import (
    AssetTotalOut,
    CategoryTotalOut,
    DashboardOut,
    MonthlyTotalOut,
    OwnerTotalOut,
)
from assets_app.selectors import (
    asset_totals,
    category_totals,
    dashboard_data,
    monthly_totals,
    owner_totals,
)

router = Router()


@router.get("/monthly-total/", response=list[MonthlyTotalOut])
def monthly_total(
    request,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
):
    results = monthly_totals(
        household=request.household,
        month_from=month_from,
        month_to=month_to,
        owner_id=owner_id,
        category_id=category_id,
        asset_id=asset_id,
    )
    return [
        MonthlyTotalOut(month=str(r["month"]), total=r["total"] or Decimal("0"))
        for r in results
    ]


@router.get("/by-category/", response=list[CategoryTotalOut])
def by_category(
    request,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
):
    results = category_totals(
        household=request.household,
        month_from=month_from,
        month_to=month_to,
        owner_id=owner_id,
        category_id=category_id,
        asset_id=asset_id,
    )
    return [
        CategoryTotalOut(
            month=str(r["month"]),
            category_id=r["asset__category__id"],
            category_name=r["asset__category__name"],
            total=r["total"] or Decimal("0"),
        )
        for r in results
    ]


@router.get("/by-owner/", response=list[OwnerTotalOut])
def by_owner(
    request,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
):
    results = owner_totals(
        household=request.household,
        month_from=month_from,
        month_to=month_to,
        owner_id=owner_id,
        category_id=category_id,
        asset_id=asset_id,
    )
    return [
        OwnerTotalOut(
            month=str(r["month"]),
            owner_id=r["asset__owner__id"],
            owner_name=r["asset__owner__name"],
            total=r["total"] or Decimal("0"),
        )
        for r in results
    ]


@router.get("/by-asset/", response=list[AssetTotalOut])
def by_asset(
    request,
    month_from: date,
    month_to: date,
    owner_id: Optional[int] = None,
    category_id: Optional[int] = None,
    asset_id: Optional[int] = None,
):
    results = asset_totals(
        household=request.household,
        month_from=month_from,
        month_to=month_to,
        owner_id=owner_id,
        category_id=category_id,
        asset_id=asset_id,
    )
    return [
        AssetTotalOut(
            month=str(r["month"]),
            asset_id=r["asset__id"],
            asset_name=r["asset__name"],
            owner_name=r["asset__owner__name"],
            category_name=r["asset__category__name"],
            total=r["total"] or Decimal("0"),
        )
        for r in results
    ]


@router.get("/dashboard/", response=DashboardOut)
def dashboard(request):
    data = dashboard_data(household=request.household)

    if data["latest_month"] is None:
        return DashboardOut(
            latest_month="",
            total=Decimal("0"),
            prev_diff=Decimal("0"),
            prev_rate=0.0,
            by_category=[],
            by_owner=[],
        )

    return DashboardOut(
        latest_month=str(data["latest_month"]),
        total=data["total"],
        prev_diff=data["prev_diff"],
        prev_rate=data["prev_rate"],
        by_category=[
            CategoryTotalOut(
                month=str(data["latest_month"]),
                category_id=r["asset__category__id"],
                category_name=r["asset__category__name"],
                total=r["total"] or Decimal("0"),
            )
            for r in data["by_category"]
        ],
        by_owner=[
            OwnerTotalOut(
                month=str(data["latest_month"]),
                owner_id=r["asset__owner__id"],
                owner_name=r["asset__owner__name"],
                total=r["total"] or Decimal("0"),
            )
            for r in data["by_owner"]
        ],
    )
