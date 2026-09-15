from datetime import date
from typing import Optional

from ninja import Router

from assets_app.schemas import (
    SnapshotBulkIn,
    SnapshotBulkRowOut,
    SnapshotIn,
    SnapshotOut,
    SnapshotRecommendedMonthOut,
    SnapshotUpdateIn,
)
from assets_app.selectors import (
    snapshot_bulk_entry_rows,
    snapshot_list,
    snapshot_recommended_month_for_asset,
)
from assets_app.services import (
    snapshot_bulk_upsert,
    snapshot_delete,
    snapshot_update,
    snapshot_upsert,
)

router = Router()


@router.get("/", response=list[SnapshotOut])
def list_snapshots(
    request,
    asset_id: Optional[int] = None,
    month_from: Optional[date] = None,
    month_to: Optional[date] = None,
):
    return list(
        snapshot_list(
            household=request.household,
            asset_id=asset_id,
            month_from=month_from,
            month_to=month_to,
        )
    )


@router.get("/recommended-month/", response=SnapshotRecommendedMonthOut)
def recommended_month(request, asset_id: int):
    recommended = snapshot_recommended_month_for_asset(
        household=request.household, asset_id=asset_id
    )
    return SnapshotRecommendedMonthOut(month=str(recommended))


@router.get("/bulk/", response=list[SnapshotBulkRowOut])
def bulk_entry_rows(request, month: date):
    return snapshot_bulk_entry_rows(household=request.household, month=month)


@router.post("/bulk/", response=list[SnapshotOut])
def bulk_upsert(request, payload: SnapshotBulkIn):
    return snapshot_bulk_upsert(
        household=request.household, month=payload.month, entries=payload.entries
    )


@router.post("/", response=SnapshotOut)
def upsert_snapshot(request, payload: SnapshotIn):
    return snapshot_upsert(
        household=request.household,
        asset_id=payload.asset_id,
        month=payload.month,
        balance=payload.balance,
    )


@router.put("/{snapshot_id}", response=SnapshotOut)
def update_snapshot(request, snapshot_id: int, payload: SnapshotUpdateIn):
    return snapshot_update(
        household=request.household, snapshot_id=snapshot_id, balance=payload.balance
    )


@router.delete("/{snapshot_id}")
def delete_snapshot(request, snapshot_id: int):
    snapshot_delete(household=request.household, snapshot_id=snapshot_id)
    return {"success": True}
