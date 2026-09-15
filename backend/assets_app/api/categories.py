from ninja import Router

from assets_app.schemas import CategoryIn, CategoryOut
from assets_app.selectors import category_get, category_list
from assets_app.services import category_create, category_delete, category_update

router = Router()


@router.get("/", response=list[CategoryOut])
def list_categories(request):
    return list(category_list(household=request.household))


@router.post("/", response=CategoryOut)
def create_category(request, payload: CategoryIn):
    return category_create(household=request.household, name=payload.name)


@router.get("/{category_id}", response=CategoryOut)
def get_category(request, category_id: int):
    return category_get(household=request.household, category_id=category_id)


@router.put("/{category_id}", response=CategoryOut)
def update_category(request, category_id: int, payload: CategoryIn):
    return category_update(
        household=request.household, category_id=category_id, name=payload.name
    )


@router.delete("/{category_id}")
def delete_category(request, category_id: int):
    category_delete(household=request.household, category_id=category_id)
    return {"success": True}
