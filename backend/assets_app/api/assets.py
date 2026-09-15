from typing import Optional

from ninja import Router

from assets_app.schemas import AssetIn, AssetOut
from assets_app.selectors import asset_get, asset_list
from assets_app.services import asset_create, asset_delete, asset_update

router = Router()


@router.get("/", response=list[AssetOut])
def list_assets(request, owner_id: Optional[int] = None, category_id: Optional[int] = None):
    return list(
        asset_list(
            household=request.household, owner_id=owner_id, category_id=category_id
        )
    )


@router.post("/", response=AssetOut)
def create_asset(request, payload: AssetIn):
    return asset_create(
        household=request.household,
        owner_id=payload.owner_id,
        category_id=payload.category_id,
        name=payload.name,
        purpose=payload.purpose,
    )


@router.get("/{asset_id}", response=AssetOut)
def get_asset(request, asset_id: int):
    return asset_get(household=request.household, asset_id=asset_id)


@router.put("/{asset_id}", response=AssetOut)
def update_asset(request, asset_id: int, payload: AssetIn):
    return asset_update(
        household=request.household,
        asset_id=asset_id,
        owner_id=payload.owner_id,
        category_id=payload.category_id,
        name=payload.name,
        purpose=payload.purpose,
    )


@router.delete("/{asset_id}")
def delete_asset(request, asset_id: int):
    asset_delete(household=request.household, asset_id=asset_id)
    return {"success": True}
