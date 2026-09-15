from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone

from assets_app.exceptions import ApplicationError
from assets_app.models import (
    Asset,
    BalanceSnapshot,
    Category,
    Household,
    Invitation,
    Membership,
    Owner,
)
from assets_app.months import month_start
from assets_app.selectors import (
    asset_get,
    category_get,
    owner_get,
    snapshot_get,
)

DEFAULT_CATEGORY_NAMES = ["現金", "銀行", "NISA", "iDeCo"]


@transaction.atomic
def household_create(*, name: str, user) -> Household:
    """Create a household, make the user its owner, and seed its categories.

    Categories are per household, so they are seeded here rather than in a
    migration; a migration can only ever create one global set.
    """
    household = Household(name=name.strip())
    household.full_clean()
    household.save()

    Membership.objects.create(
        user=user, household=household, role=Membership.OWNER
    )
    for category_name in DEFAULT_CATEGORY_NAMES:
        Category.objects.create(household=household, name=category_name)

    return household


@transaction.atomic
def invitation_create(
    *, household: Household, created_by, role: str = Membership.MEMBER
) -> Invitation:
    invitation = Invitation(
        household=household, created_by=created_by, role=role
    )
    invitation.full_clean()
    invitation.save()
    return invitation


@transaction.atomic
def invitation_revoke(*, household: Household, invitation_id: int) -> None:
    invitation = Invitation.objects.get(household=household, id=invitation_id)
    invitation.delete()


def invitation_for_token(*, token: str) -> Invitation:
    """Raise DoesNotExist for an unknown token, ApplicationError for a dead one.

    Both map onto responses that reveal nothing to someone without a token.
    """
    invitation = Invitation.objects.select_related("household").get(token=token)
    if not invitation.is_usable():
        raise ApplicationError("この招待リンクは期限切れか、すでに使われています")
    return invitation


@transaction.atomic
def invitation_accept(*, token: str, username: str, password: str):
    """Create the account and the membership together.

    The token authorises the registration, so this works even when open signup
    is disabled. Locking the row keeps two people from spending one invite.
    """
    User = get_user_model()
    invitation = Invitation.objects.select_for_update().select_related(
        "household"
    ).get(token=token)
    if not invitation.is_usable():
        raise ApplicationError("この招待リンクは期限切れか、すでに使われています")

    username = username.strip()
    if not username:
        raise ApplicationError("ユーザー名を入力してください")

    validate_password(password)

    try:
        user = User.objects.create_user(username=username, password=password)
    except IntegrityError as exc:
        raise ApplicationError("このユーザー名はすでに使われています") from exc

    Membership.objects.create(
        user=user, household=invitation.household, role=invitation.role
    )
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["accepted_at"])
    return user


@transaction.atomic
def owner_create(*, household: Household, name: str) -> Owner:
    owner = Owner(household=household, name=name.strip())
    owner.full_clean()
    owner.save()
    return owner


@transaction.atomic
def owner_update(*, household: Household, owner_id: int, name: str) -> Owner:
    owner = owner_get(household=household, owner_id=owner_id)
    owner.name = name.strip()
    owner.full_clean()
    owner.save()
    return owner


@transaction.atomic
def owner_delete(*, household: Household, owner_id: int) -> None:
    owner = owner_get(household=household, owner_id=owner_id)
    try:
        owner.delete()
    except ProtectedError as exc:
        raise ApplicationError(
            "この名義人には資産が登録されています。先に資産を削除してください。"
        ) from exc


@transaction.atomic
def category_create(*, household: Household, name: str) -> Category:
    name = name.strip()
    category = Category(household=household, name=name)
    category.full_clean()
    try:
        category.save()
    except IntegrityError as exc:
        raise ApplicationError(f"カテゴリ名「{category.name}」はすでに存在します") from exc
    return category


@transaction.atomic
def category_update(*, household: Household, category_id: int, name: str) -> Category:
    category = category_get(household=household, category_id=category_id)
    category.name = name.strip()
    category.full_clean()
    try:
        category.save()
    except IntegrityError as exc:
        raise ApplicationError(f"カテゴリ名「{category.name}」はすでに存在します") from exc
    return category


@transaction.atomic
def category_delete(*, household: Household, category_id: int) -> None:
    category = category_get(household=household, category_id=category_id)
    try:
        category.delete()
    except ProtectedError as exc:
        raise ApplicationError(
            "このカテゴリには資産が登録されています。先に資産を削除してください。"
        ) from exc


@transaction.atomic
def asset_create(
    *, household: Household, owner_id: int, category_id: int, name: str, purpose: str = ""
) -> Asset:
    asset = Asset(
        household=household,
        owner=owner_get(household=household, owner_id=owner_id),
        category=category_get(household=household, category_id=category_id),
        name=name.strip(),
        purpose=purpose.strip(),
    )
    asset.full_clean()
    asset.save()
    return asset_get(household=household, asset_id=asset.id)


@transaction.atomic
def asset_update(
    *,
    household: Household,
    asset_id: int,
    owner_id: int,
    category_id: int,
    name: str,
    purpose: str = "",
) -> Asset:
    asset = asset_get(household=household, asset_id=asset_id)
    asset.owner = owner_get(household=household, owner_id=owner_id)
    asset.category = category_get(household=household, category_id=category_id)
    asset.name = name.strip()
    asset.purpose = purpose.strip()
    asset.full_clean()
    asset.save()
    return asset_get(household=household, asset_id=asset.id)


@transaction.atomic
def asset_delete(*, household: Household, asset_id: int) -> None:
    asset = asset_get(household=household, asset_id=asset_id)
    asset.delete()


@transaction.atomic
def snapshot_upsert(
    *, household: Household, asset_id: int, month: date, balance: Decimal
) -> BalanceSnapshot:
    asset = asset_get(household=household, asset_id=asset_id)
    normalized_month = month_start(month)
    snapshot = BalanceSnapshot.objects.filter(
        asset=asset, month=normalized_month
    ).first()
    if snapshot is None:
        snapshot = BalanceSnapshot(asset=asset, month=normalized_month)
    snapshot.balance = balance
    snapshot.full_clean()
    snapshot.save()
    return snapshot


@transaction.atomic
def snapshot_bulk_upsert(
    *, household: Household, month: date, entries: list
) -> list[BalanceSnapshot]:
    """Record a whole month at once, all or nothing.

    Saving ten balances and losing them because the eleventh was rejected is
    worse than saving none, so the whole batch shares one transaction.
    """
    seen: set[int] = set()
    for entry in entries:
        if entry.asset_id in seen:
            raise ApplicationError("同じ資産が複数回含まれています")
        seen.add(entry.asset_id)

    normalized_month = month_start(month)
    return [
        snapshot_upsert(
            household=household,
            asset_id=entry.asset_id,
            month=normalized_month,
            balance=entry.balance,
        )
        for entry in entries
    ]


@transaction.atomic
def snapshot_update(
    *, household: Household, snapshot_id: int, balance: Decimal
) -> BalanceSnapshot:
    snapshot = snapshot_get(household=household, snapshot_id=snapshot_id)
    snapshot.balance = balance
    snapshot.full_clean()
    snapshot.save()
    return snapshot


@transaction.atomic
def snapshot_delete(*, household: Household, snapshot_id: int) -> None:
    snapshot = snapshot_get(household=household, snapshot_id=snapshot_id)
    snapshot.delete()
