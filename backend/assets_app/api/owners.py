from ninja import Router

from assets_app.schemas import OwnerIn, OwnerOut
from assets_app.selectors import owner_get, owner_list
from assets_app.services import owner_create, owner_delete, owner_update

router = Router()


@router.get("/", response=list[OwnerOut])
def list_owners(request):
    return list(owner_list(household=request.household))


@router.post("/", response=OwnerOut)
def create_owner(request, payload: OwnerIn):
    return owner_create(household=request.household, name=payload.name)


@router.get("/{owner_id}", response=OwnerOut)
def get_owner(request, owner_id: int):
    return owner_get(household=request.household, owner_id=owner_id)


@router.put("/{owner_id}", response=OwnerOut)
def update_owner(request, owner_id: int, payload: OwnerIn):
    return owner_update(
        household=request.household, owner_id=owner_id, name=payload.name
    )


@router.delete("/{owner_id}")
def delete_owner(request, owner_id: int):
    owner_delete(household=request.household, owner_id=owner_id)
    return {"success": True}
