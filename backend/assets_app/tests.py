import os
import subprocess
import sys
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from django.test import Client

from assets_app.models import (
    Asset,
    BalanceSnapshot,
    Category,
    Household,
    Invitation,
    Membership,
    Owner,
)


def test_health_endpoint_is_public(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_database_health_endpoint_is_public(client):
    response = client.get("/api/health/db/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.fixture
def household():
    return Household.objects.create(name="わが家")


@pytest.fixture
def user(household):
    user = User.objects.create_user(username="sample_taro", password="password123")
    Membership.objects.create(user=user, household=household, role=Membership.OWNER)
    return user


@pytest.fixture
def authenticated_client(client, user):
    client.force_login(user)
    client.get("/api/auth/csrf/")
    client.defaults["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client


@pytest.fixture
def csrf_client(client):
    client.get("/api/auth/csrf/")
    client.defaults["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client


@pytest.fixture
def owner(household):
    return Owner.objects.create(household=household, name="サンプル太郎")


@pytest.fixture
def category(household):
    return Category.objects.create(household=household, name="預金")


@pytest.fixture
def asset_factory(household, owner, category):
    def create(name: str) -> Asset:
        return Asset.objects.create(
            household=household,
            owner=owner,
            category=category,
            name=name,
            purpose="",
        )

    return create


@pytest.mark.django_db
def test_recommended_month_returns_oldest_missing_month(
    authenticated_client, asset_factory
):
    # Arrange
    asset = asset_factory("メイン口座")
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 3, 1), balance="100000")
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 5, 1), balance="120000")

    # Act
    response = authenticated_client.get(
        "/api/snapshots/recommended-month/", {"asset_id": asset.id}
    )

    # Assert
    assert response.status_code == 200
    assert response.json() == {"month": "2026-04-01"}


@pytest.mark.django_db
def test_recommended_month_returns_global_earliest_month_for_new_asset(
    authenticated_client, asset_factory
):
    # Arrange
    existing_asset = asset_factory("既存口座")
    target_asset = asset_factory("新規口座")
    BalanceSnapshot.objects.create(
        asset=existing_asset, month=date(2026, 2, 1), balance="90000"
    )
    BalanceSnapshot.objects.create(
        asset=existing_asset, month=date(2026, 3, 1), balance="95000"
    )

    # Act
    response = authenticated_client.get(
        "/api/snapshots/recommended-month/", {"asset_id": target_asset.id}
    )

    # Assert
    assert response.status_code == 200
    assert response.json() == {"month": "2026-02-01"}


@pytest.mark.django_db
def test_recommended_month_returns_current_month_when_no_gap_exists(
    authenticated_client, asset_factory
):
    # Arrange
    asset = asset_factory("積立口座")
    today = date.today()
    current_month = date(today.year, today.month, 1)
    previous_month = (
        date(today.year - 1, 12, 1)
        if today.month == 1
        else date(today.year, today.month - 1, 1)
    )
    BalanceSnapshot.objects.create(asset=asset, month=previous_month, balance="100000")
    BalanceSnapshot.objects.create(asset=asset, month=current_month, balance="110000")

    # Act
    response = authenticated_client.get(
        "/api/snapshots/recommended-month/", {"asset_id": asset.id}
    )

    # Assert
    assert response.status_code == 200
    assert response.json() == {"month": str(current_month)}


@pytest.mark.django_db
def test_missing_asset_returns_not_found(authenticated_client):
    # Act
    response = authenticated_client.get("/api/assets/999999")

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "対象のデータが見つかりません"}


@pytest.mark.django_db
def test_empty_owner_name_returns_bad_request(authenticated_client):
    # Act
    response = authenticated_client.post(
        "/api/owners/",
        data={"name": "   "},
        content_type="application/json",
    )

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "このフィールドは空ではいけません。"}


@pytest.mark.django_db
def test_authenticated_asset_crud_api(authenticated_client, owner, category):
    create_response = authenticated_client.post(
        "/api/assets/",
        data={
            "owner_id": owner.id,
            "category_id": category.id,
            "name": "SBIネット銀行",
            "purpose": "生活費用",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "SBIネット銀行"
    assert created["owner"] == {"id": owner.id, "name": owner.name}
    assert created["category"] == {"id": category.id, "name": category.name}

    asset_id = created["id"]
    list_response = authenticated_client.get("/api/assets/")
    assert list_response.status_code == 200
    assert [asset["id"] for asset in list_response.json()] == [asset_id]

    update_response = authenticated_client.put(
        f"/api/assets/{asset_id}",
        data={
            "owner_id": owner.id,
            "category_id": category.id,
            "name": "SBI証券",
            "purpose": "投資用",
        },
        content_type="application/json",
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "SBI証券"
    assert update_response.json()["purpose"] == "投資用"

    delete_response = authenticated_client.delete(f"/api/assets/{asset_id}")
    assert delete_response.status_code == 200
    assert Asset.objects.filter(id=asset_id).exists() is False


@pytest.mark.django_db
def test_delete_owner_with_assets_returns_bad_request(
    authenticated_client, asset_factory, owner
):
    asset_factory("メイン口座")

    response = authenticated_client.delete(f"/api/owners/{owner.id}")

    assert response.status_code == 400
    assert response.json() == {
        "detail": "この名義人には資産が登録されています。先に資産を削除してください。"
    }
    assert Owner.objects.filter(id=owner.id).exists() is True


@pytest.mark.django_db
def test_delete_category_with_assets_returns_bad_request(
    authenticated_client, asset_factory, category
):
    asset_factory("メイン口座")

    response = authenticated_client.delete(f"/api/categories/{category.id}")

    assert response.status_code == 400
    assert response.json() == {
        "detail": "このカテゴリには資産が登録されています。先に資産を削除してください。"
    }
    assert Category.objects.filter(id=category.id).exists() is True


@pytest.mark.django_db
def test_authenticated_snapshot_crud_api(authenticated_client, asset_factory):
    asset = asset_factory("メイン口座")

    create_response = authenticated_client.post(
        "/api/snapshots/",
        data={"asset_id": asset.id, "month": "2026-05-01", "balance": "1500000"},
        content_type="application/json",
    )

    assert create_response.status_code == 200
    created = create_response.json()
    assert created["asset_id"] == asset.id
    assert created["month"] == "2026-05-01"
    assert created["balance"] == "1500000"

    snapshot_id = created["id"]
    list_response = authenticated_client.get("/api/snapshots/", {"asset_id": asset.id})
    assert list_response.status_code == 200
    assert [snapshot["id"] for snapshot in list_response.json()] == [snapshot_id]

    update_response = authenticated_client.put(
        f"/api/snapshots/{snapshot_id}",
        data={"balance": "1750000"},
        content_type="application/json",
    )
    assert update_response.status_code == 200
    assert update_response.json()["balance"] == "1750000"

    delete_response = authenticated_client.delete(f"/api/snapshots/{snapshot_id}")
    assert delete_response.status_code == 200
    assert BalanceSnapshot.objects.filter(id=snapshot_id).exists() is False


@pytest.mark.django_db
def test_analytics_filters_totals_by_owner_category_and_asset(
    authenticated_client, household
):
    sample_taro = Owner.objects.create(household=household, name="サンプル太郎")
    sample_hanako = Owner.objects.create(household=household, name="サンプル花子")
    bank = Category.objects.create(household=household, name="銀行")
    nisa = Category.objects.create(household=household, name="NISA")
    sample_taro_bank = Asset.objects.create(
        household=household, owner=sample_taro, category=bank, name="サンプル太郎の銀行", purpose=""
    )
    sample_taro_nisa = Asset.objects.create(
        household=household, owner=sample_taro, category=nisa, name="サンプル太郎のNISA", purpose=""
    )
    sample_hanako_bank = Asset.objects.create(
        household=household, owner=sample_hanako, category=bank, name="サンプル花子の銀行", purpose=""
    )
    BalanceSnapshot.objects.bulk_create(
        [
            BalanceSnapshot(
                asset=sample_taro_bank, month=date(2026, 6, 1), balance="100000"
            ),
            BalanceSnapshot(
                asset=sample_taro_bank, month=date(2026, 7, 1), balance="120000"
            ),
            BalanceSnapshot(
                asset=sample_taro_nisa, month=date(2026, 7, 1), balance="300000"
            ),
            BalanceSnapshot(
                asset=sample_hanako_bank, month=date(2026, 7, 1), balance="500000"
            ),
        ]
    )
    date_range = {"month_from": "2026-06-01", "month_to": "2026-07-01"}

    owner_response = authenticated_client.get(
        "/api/analytics/monthly-total/",
        date_range | {"owner_id": sample_taro.id},
    )
    category_response = authenticated_client.get(
        "/api/analytics/monthly-total/",
        date_range | {"owner_id": sample_taro.id, "category_id": bank.id},
    )
    asset_response = authenticated_client.get(
        "/api/analytics/monthly-total/",
        date_range | {"asset_id": sample_hanako_bank.id},
    )

    assert owner_response.status_code == 200
    assert owner_response.json() == [
        {"month": "2026-06-01", "total": "100000.00"},
        {"month": "2026-07-01", "total": "420000.00"},
    ]
    assert category_response.status_code == 200
    assert category_response.json() == [
        {"month": "2026-06-01", "total": "100000.00"},
        {"month": "2026-07-01", "total": "120000.00"},
    ]
    assert asset_response.status_code == 200
    assert asset_response.json() == [
        {"month": "2026-07-01", "total": "500000.00"}
    ]


@pytest.mark.django_db
def test_analytics_returns_filtered_asset_breakdown(authenticated_client, household):
    sample_taro = Owner.objects.create(household=household, name="サンプル太郎")
    sample_hanako = Owner.objects.create(household=household, name="サンプル花子")
    bank = Category.objects.create(household=household, name="銀行")
    sample_taro_main = Asset.objects.create(
        household=household, owner=sample_taro, category=bank, name="メイン口座", purpose=""
    )
    sample_taro_savings = Asset.objects.create(
        household=household, owner=sample_taro, category=bank, name="貯蓄口座", purpose=""
    )
    sample_hanako_main = Asset.objects.create(
        household=household, owner=sample_hanako, category=bank, name="妻口座", purpose=""
    )
    BalanceSnapshot.objects.bulk_create(
        [
            BalanceSnapshot(
                asset=sample_taro_main, month=date(2026, 7, 1), balance="120000"
            ),
            BalanceSnapshot(
                asset=sample_taro_savings, month=date(2026, 7, 1), balance="80000"
            ),
            BalanceSnapshot(
                asset=sample_hanako_main, month=date(2026, 7, 1), balance="500000"
            ),
        ]
    )

    response = authenticated_client.get(
        "/api/analytics/by-asset/",
        {
            "month_from": "2026-07-01",
            "month_to": "2026-07-01",
            "owner_id": sample_taro.id,
            "category_id": bank.id,
        },
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "month": "2026-07-01",
            "asset_id": sample_taro_main.id,
            "asset_name": "メイン口座",
            "owner_name": "サンプル太郎",
            "category_name": "銀行",
            "total": "120000.00",
        },
        {
            "month": "2026-07-01",
            "asset_id": sample_taro_savings.id,
            "asset_name": "貯蓄口座",
            "owner_name": "サンプル太郎",
            "category_name": "銀行",
            "total": "80000.00",
        },
    ]


@pytest.mark.django_db
def test_protected_api_requires_authentication(client):
    response = client.get("/api/assets/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_write_api_requires_csrf(user, owner, category):
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)

    response = client.post(
        "/api/assets/",
        data={
            "owner_id": owner.id,
            "category_id": category.id,
            "name": "SBIネット銀行",
            "purpose": "生活費用",
        },
        content_type="application/json",
    )

    assert response.status_code == 403


def test_api_docs_are_disabled_in_production():
    env = os.environ | {
        "DJANGO_ENV": "production",
        "DJANGO_SECRET_KEY": "test-secret",
        "DJANGO_ALLOWED_HOSTS": "testserver",
        "DATABASE_URL": "postgresql://shisan:shisan@localhost:15432/shisan",
    }
    result = subprocess.run(
        [
            sys.executable,
            "manage.py",
            "shell",
            "-c",
            (
                "from django.test import Client; "
                "client = Client(); "
                "print(client.get('/api/docs', secure=True).status_code); "
                "print(client.get('/api/openapi.json', secure=True).status_code)"
            ),
        ],
        check=True,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip().splitlines()[-2:] == ["404", "404"]


@pytest.mark.django_db
def test_login_returns_authenticated_user(csrf_client, user):
    response = csrf_client.post(
        "/api/auth/login/",
        data={"username": "sample_taro", "password": "password123"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "user": {"id": user.id, "username": "sample_taro"},
    }


@pytest.mark.django_db
def test_login_rejects_invalid_credentials(csrf_client, user):
    response = csrf_client.post(
        "/api/auth/login/",
        data={"username": "sample_taro", "password": "wrong"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "ユーザー名またはパスワードが違います"}


@pytest.mark.django_db
def test_logout_clears_session(authenticated_client):
    logout_response = authenticated_client.post(
        "/api/auth/logout/",
        data={},
        content_type="application/json",
    )
    assets_response = authenticated_client.get("/api/assets/")

    assert logout_response.status_code == 200
    assert logout_response.json() == {"authenticated": False, "user": None}
    assert assets_response.status_code == 401


@pytest.mark.django_db
def test_login_requires_csrf_when_csrf_checks_are_enforced(user):
    client = Client(enforce_csrf_checks=True)

    response = client.post(
        "/api/auth/login/",
        data={"username": "sample_taro", "password": "password123"},
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.fixture
def other_household():
    """A second tenant, used to prove one household cannot reach another."""
    return Household.objects.create(name="となりの家")


@pytest.fixture
def intruder_client(other_household):
    user = User.objects.create_user(username="intruder", password="password123")
    Membership.objects.create(
        user=user, household=other_household, role=Membership.OWNER
    )
    intruder = Client()
    intruder.force_login(user)
    intruder.get("/api/auth/csrf/")
    intruder.defaults["HTTP_X_CSRFTOKEN"] = intruder.cookies["csrftoken"].value
    return intruder


@pytest.fixture
def victim_data(household, owner, category, asset_factory):
    """Rows owned by `household`, which the intruder must never reach."""
    asset = asset_factory("被害者の口座")
    snapshot = BalanceSnapshot.objects.create(
        asset=asset, month=date(2026, 1, 1), balance="1000000"
    )
    return {
        "owner": owner,
        "category": category,
        "asset": asset,
        "snapshot": snapshot,
    }


@pytest.mark.django_db
def test_listing_endpoints_never_leak_another_household(
    intruder_client, victim_data
):
    for path in ["/api/owners/", "/api/categories/", "/api/assets/", "/api/snapshots/"]:
        response = intruder_client.get(path)

        assert response.status_code == 200, path
        assert response.json() == [], f"{path} leaked another household's rows"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path_template,key",
    [
        ("/api/owners/{id}", "owner"),
        ("/api/categories/{id}", "category"),
        ("/api/assets/{id}", "asset"),
    ],
)
def test_reading_another_households_row_is_not_found(
    intruder_client, victim_data, path_template, key
):
    # 404 rather than 403: a 403 would confirm the id exists.
    response = intruder_client.get(path_template.format(id=victim_data[key].id))

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path_template,key,payload",
    [
        ("/api/owners/{id}", "owner", {"name": "乗っ取り"}),
        ("/api/categories/{id}", "category", {"name": "乗っ取り"}),
        (
            "/api/assets/{id}",
            "asset",
            {"owner_id": 1, "category_id": 1, "name": "乗っ取り", "purpose": ""},
        ),
        ("/api/snapshots/{id}", "snapshot", {"balance": "1"}),
    ],
)
def test_updating_another_households_row_is_not_found(
    intruder_client, victim_data, path_template, key, payload
):
    target = victim_data[key]

    response = intruder_client.put(
        path_template.format(id=target.id),
        data=payload,
        content_type="application/json",
    )

    assert response.status_code == 404
    target.refresh_from_db()
    assert "乗っ取り" not in str(target)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path_template,key",
    [
        ("/api/owners/{id}", "owner"),
        ("/api/categories/{id}", "category"),
        ("/api/assets/{id}", "asset"),
        ("/api/snapshots/{id}", "snapshot"),
    ],
)
def test_deleting_another_households_row_is_not_found(
    intruder_client, victim_data, path_template, key
):
    target = victim_data[key]

    response = intruder_client.delete(path_template.format(id=target.id))

    assert response.status_code == 404
    assert type(target).objects.filter(id=target.id).exists()


@pytest.mark.django_db
def test_creating_an_asset_against_another_households_owner_is_not_found(
    intruder_client, victim_data
):
    response = intruder_client.post(
        "/api/assets/",
        data={
            "owner_id": victim_data["owner"].id,
            "category_id": victim_data["category"].id,
            "name": "他人の名義人にぶら下げる",
            "purpose": "",
        },
        content_type="application/json",
    )

    assert response.status_code == 404
    assert Asset.objects.filter(name="他人の名義人にぶら下げる").exists() is False


@pytest.mark.django_db
def test_writing_a_snapshot_against_another_households_asset_is_not_found(
    intruder_client, victim_data
):
    response = intruder_client.post(
        "/api/snapshots/",
        data={
            "asset_id": victim_data["asset"].id,
            "month": "2026-02-01",
            "balance": "999",
        },
        content_type="application/json",
    )

    assert response.status_code == 404
    assert BalanceSnapshot.objects.filter(balance="999").exists() is False


@pytest.mark.django_db
def test_recommended_month_does_not_reach_another_households_asset(
    intruder_client, victim_data
):
    response = intruder_client.get(
        f"/api/snapshots/recommended-month/?asset_id={victim_data['asset'].id}"
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path",
    [
        "/api/analytics/monthly-total/?month_from=2026-01-01&month_to=2026-12-01",
        "/api/analytics/by-category/?month_from=2026-01-01&month_to=2026-12-01",
        "/api/analytics/by-owner/?month_from=2026-01-01&month_to=2026-12-01",
        "/api/analytics/by-asset/?month_from=2026-01-01&month_to=2026-12-01",
    ],
)
def test_analytics_never_aggregate_another_household(
    intruder_client, victim_data, path
):
    response = intruder_client.get(path)

    assert response.status_code == 200
    assert response.json() == [], f"{path} aggregated another household's balances"


@pytest.mark.django_db
def test_dashboard_never_totals_another_household(intruder_client, victim_data):
    response = intruder_client.get("/api/analytics/dashboard/")

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total"]) == Decimal("0")
    assert body["by_category"] == []
    assert body["by_owner"] == []


@pytest.mark.django_db
def test_a_user_without_a_household_is_refused(client):
    stray = User.objects.create_user(username="stray", password="password123")
    client.force_login(stray)

    response = client.get("/api/owners/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_two_households_may_hold_the_same_category_name(
    household, other_household
):
    Category.objects.create(household=household, name="銀行")

    # The old global unique constraint would have rejected this.
    Category.objects.create(household=other_household, name="銀行")


@pytest.mark.django_db
def test_signup_is_refused_unless_the_instance_opts_in(csrf_client):
    # Default is closed: a self-hosted instance must not let strangers register.
    response = csrf_client.post(
        "/api/auth/signup/",
        data={
            "username": "newcomer",
            "password": "a-long-enough-password",
            "household_name": "新しい家",
        },
        content_type="application/json",
    )

    assert response.status_code == 403
    assert User.objects.filter(username="newcomer").exists() is False


@pytest.mark.django_db
def test_signup_creates_a_usable_household(csrf_client, settings):
    settings.ALLOW_SIGNUP = True

    response = csrf_client.post(
        "/api/auth/signup/",
        data={
            "username": "newcomer",
            "password": "a-long-enough-password",
            "household_name": "新しい家",
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["authenticated"] is True

    user = User.objects.get(username="newcomer")
    household = Household.objects.get(name="新しい家")
    assert Membership.objects.filter(
        user=user, household=household, role=Membership.OWNER
    ).exists()
    # Seeded per household, since a migration could only ever seed one global set.
    assert household.categories.count() == 4

    # The whole point: the new account can actually reach its own data.
    listing = csrf_client.get("/api/categories/")
    assert listing.status_code == 200
    assert len(listing.json()) == 4


@pytest.mark.django_db
def test_signup_rejects_a_weak_password(csrf_client, settings):
    settings.ALLOW_SIGNUP = True

    response = csrf_client.post(
        "/api/auth/signup/",
        data={"username": "newcomer", "password": "1234", "household_name": "新しい家"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert User.objects.filter(username="newcomer").exists() is False


@pytest.mark.django_db
def test_signup_leaves_no_stranded_user_when_the_household_name_is_blank(
    csrf_client, settings
):
    settings.ALLOW_SIGNUP = True

    response = csrf_client.post(
        "/api/auth/signup/",
        data={
            "username": "newcomer",
            "password": "a-long-enough-password",
            "household_name": "   ",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert User.objects.filter(username="newcomer").exists() is False


@pytest.mark.django_db
def test_signup_does_not_join_an_existing_household(csrf_client, settings, victim_data):
    settings.ALLOW_SIGNUP = True

    csrf_client.post(
        "/api/auth/signup/",
        data={
            "username": "newcomer",
            "password": "a-long-enough-password",
            "household_name": "新しい家",
        },
        content_type="application/json",
    )

    # A fresh signup must land in its own household, not inherit anyone's data.
    assert csrf_client.get("/api/assets/").json() == []
    assert csrf_client.get("/api/owners/").json() == []


@pytest.mark.django_db
def test_create_household_command_onboards_an_existing_user():
    from django.core.management import call_command

    user = User.objects.create_user(username="selfhoster", password="password123")

    call_command("create_household", name="わが家", username="selfhoster")

    household = Household.objects.get(name="わが家")
    assert Membership.objects.filter(user=user, household=household).exists()
    assert household.categories.count() == 4


@pytest.mark.django_db
def test_create_household_command_refuses_a_second_household():
    from django.core.management import call_command
    from django.core.management.base import CommandError

    User.objects.create_user(username="selfhoster", password="password123")
    call_command("create_household", name="わが家", username="selfhoster")

    with pytest.raises(CommandError):
        call_command("create_household", name="ふたつめ", username="selfhoster")


@pytest.mark.django_db
def test_create_household_command_reports_a_missing_user():
    from django.core.management import call_command
    from django.core.management.base import CommandError

    with pytest.raises(CommandError, match="createsuperuser"):
        call_command("create_household", name="わが家", username="nobody")


@pytest.fixture
def invitation(household, user):
    from assets_app.services import invitation_create

    return invitation_create(household=household, created_by=user)


@pytest.mark.django_db
def test_invitation_page_names_the_household_without_authentication(client, invitation):
    response = client.get(f"/api/auth/invitation/{invitation.token}/")

    assert response.status_code == 200
    assert response.json() == {"household_name": "わが家"}


@pytest.mark.django_db
def test_an_unknown_invitation_token_is_not_found(client):
    response = client.get("/api/auth/invitation/not-a-real-token/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_accepting_an_invitation_works_while_signup_stays_closed(
    csrf_client, invitation, settings
):
    # The token is the authorisation; open registration remains off.
    assert settings.ALLOW_SIGNUP is False

    response = csrf_client.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "partner", "password": "a-long-enough-password"},
        content_type="application/json",
    )

    assert response.status_code == 200
    partner = User.objects.get(username="partner")
    assert Membership.objects.filter(
        user=partner, household=invitation.household, role=Membership.MEMBER
    ).exists()


@pytest.mark.django_db
def test_an_invited_member_sees_the_same_household_data(
    csrf_client, invitation, asset_factory
):
    asset_factory("共有の口座")

    csrf_client.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "partner", "password": "a-long-enough-password"},
        content_type="application/json",
    )

    listing = csrf_client.get("/api/assets/")
    assert listing.status_code == 200
    assert [a["name"] for a in listing.json()] == ["共有の口座"]


@pytest.mark.django_db
def test_an_invitation_cannot_be_spent_twice(csrf_client, invitation):
    csrf_client.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "partner", "password": "a-long-enough-password"},
        content_type="application/json",
    )

    second = Client()
    second.get("/api/auth/csrf/")
    second.defaults["HTTP_X_CSRFTOKEN"] = second.cookies["csrftoken"].value
    response = second.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "gatecrasher", "password": "a-long-enough-password"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert User.objects.filter(username="gatecrasher").exists() is False


@pytest.mark.django_db
def test_an_expired_invitation_is_refused(csrf_client, invitation):
    from django.utils import timezone

    invitation.expires_at = timezone.now() - timedelta(minutes=1)
    invitation.save(update_fields=["expires_at"])

    response = csrf_client.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "latecomer", "password": "a-long-enough-password"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert User.objects.filter(username="latecomer").exists() is False


@pytest.mark.django_db
def test_a_weak_password_leaves_no_account_and_keeps_the_invitation(
    csrf_client, invitation
):
    response = csrf_client.post(
        f"/api/auth/invitation/{invitation.token}/accept/",
        data={"username": "partner", "password": "1234"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert User.objects.filter(username="partner").exists() is False
    invitation.refresh_from_db()
    assert invitation.accepted_at is None, "a failed attempt burned the invitation"


@pytest.mark.django_db
def test_invitations_of_another_household_are_invisible(
    intruder_client, invitation
):
    listing = intruder_client.get("/api/invitations/")

    assert listing.status_code == 200
    assert listing.json() == []


@pytest.mark.django_db
def test_revoking_another_households_invitation_is_not_found(
    intruder_client, invitation
):
    response = intruder_client.delete(f"/api/invitations/{invitation.id}")

    assert response.status_code == 404
    invitation.refresh_from_db()


@pytest.mark.django_db
def test_a_created_invitation_belongs_to_the_creators_household(
    authenticated_client, household
):
    response = authenticated_client.post(
        "/api/invitations/", data={"role": "member"}, content_type="application/json"
    )

    assert response.status_code == 200
    body = response.json()
    assert Invitation.objects.get(token=body["token"]).household == household
    # A guessable token would make the whole scheme pointless.
    assert len(body["token"]) >= 32


@pytest.fixture
def bulk_assets(household, owner, category):
    def make(name: str) -> Asset:
        return Asset.objects.create(
            household=household, owner=owner, category=category, name=name, purpose=""
        )

    return [make("口座A"), make("口座B"), make("口座C")]


@pytest.mark.django_db
def test_bulk_rows_list_every_asset_even_with_nothing_recorded(
    authenticated_client, bulk_assets
):
    response = authenticated_client.get("/api/snapshots/bulk/?month=2026-08-01")

    assert response.status_code == 200
    rows = response.json()
    assert [r["asset_name"] for r in rows] == ["口座A", "口座B", "口座C"]
    assert all(r["current_balance"] is None for r in rows)
    assert all(r["previous_balance"] is None for r in rows)


@pytest.mark.django_db
def test_bulk_rows_report_the_most_recent_earlier_month_as_reference(
    authenticated_client, bulk_assets
):
    asset = bulk_assets[0]
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 5, 1), balance="100")
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 7, 1), balance="300")
    # A later month must not be mistaken for the previous one.
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 9, 1), balance="900")

    rows = authenticated_client.get("/api/snapshots/bulk/?month=2026-08-01").json()
    row = next(r for r in rows if r["asset_id"] == asset.id)

    assert row["previous_month"] == "2026-07-01"
    assert Decimal(row["previous_balance"]) == Decimal("300")
    assert row["current_balance"] is None


@pytest.mark.django_db
def test_bulk_rows_separate_an_existing_entry_from_the_reference(
    authenticated_client, bulk_assets
):
    asset = bulk_assets[0]
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 7, 1), balance="300")
    BalanceSnapshot.objects.create(asset=asset, month=date(2026, 8, 1), balance="350")

    rows = authenticated_client.get("/api/snapshots/bulk/?month=2026-08-01").json()
    row = next(r for r in rows if r["asset_id"] == asset.id)

    assert Decimal(row["current_balance"]) == Decimal("350")
    assert Decimal(row["previous_balance"]) == Decimal("300")


@pytest.mark.django_db
def test_bulk_upsert_records_a_whole_month_at_once(authenticated_client, bulk_assets):
    response = authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-01",
            "entries": [
                {"asset_id": bulk_assets[0].id, "balance": "1000"},
                {"asset_id": bulk_assets[1].id, "balance": "2000"},
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 200
    assert BalanceSnapshot.objects.filter(month=date(2026, 8, 1)).count() == 2
    # Omitted assets are skipped, not recorded as zero.
    assert (
        BalanceSnapshot.objects.filter(asset=bulk_assets[2], month=date(2026, 8, 1))
        .exists()
        is False
    )


@pytest.mark.django_db
def test_bulk_upsert_records_an_explicit_zero(authenticated_client, bulk_assets):
    # A closed account really is zero, and must be distinguishable from blank.
    authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-01",
            "entries": [{"asset_id": bulk_assets[0].id, "balance": "0"}],
        },
        content_type="application/json",
    )

    snapshot = BalanceSnapshot.objects.get(
        asset=bulk_assets[0], month=date(2026, 8, 1)
    )
    assert snapshot.balance == Decimal("0")


@pytest.mark.django_db
def test_bulk_upsert_overwrites_an_existing_month(authenticated_client, bulk_assets):
    BalanceSnapshot.objects.create(
        asset=bulk_assets[0], month=date(2026, 8, 1), balance="111"
    )

    authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-01",
            "entries": [{"asset_id": bulk_assets[0].id, "balance": "999"}],
        },
        content_type="application/json",
    )

    assert (
        BalanceSnapshot.objects.get(
            asset=bulk_assets[0], month=date(2026, 8, 1)
        ).balance
        == Decimal("999")
    )
    assert BalanceSnapshot.objects.filter(asset=bulk_assets[0]).count() == 1


@pytest.mark.django_db
def test_bulk_upsert_normalises_a_mid_month_date(authenticated_client, bulk_assets):
    authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-17",
            "entries": [{"asset_id": bulk_assets[0].id, "balance": "500"}],
        },
        content_type="application/json",
    )

    assert BalanceSnapshot.objects.get(asset=bulk_assets[0]).month == date(2026, 8, 1)


@pytest.mark.django_db
def test_a_bad_row_saves_none_of_the_batch(
    authenticated_client, bulk_assets, other_household, owner, category
):
    intruder_asset = Asset.objects.create(
        household=other_household,
        owner=Owner.objects.create(household=other_household, name="他人"),
        category=Category.objects.create(household=other_household, name="銀行"),
        name="他世帯の口座",
        purpose="",
    )

    response = authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-01",
            "entries": [
                {"asset_id": bulk_assets[0].id, "balance": "1000"},
                {"asset_id": intruder_asset.id, "balance": "2000"},
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 404
    # The valid row must not survive on its own.
    assert BalanceSnapshot.objects.filter(month=date(2026, 8, 1)).exists() is False


@pytest.mark.django_db
def test_bulk_upsert_rejects_the_same_asset_twice(authenticated_client, bulk_assets):
    response = authenticated_client.post(
        "/api/snapshots/bulk/",
        data={
            "month": "2026-08-01",
            "entries": [
                {"asset_id": bulk_assets[0].id, "balance": "1000"},
                {"asset_id": bulk_assets[0].id, "balance": "2000"},
            ],
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert BalanceSnapshot.objects.filter(month=date(2026, 8, 1)).exists() is False


@pytest.mark.django_db
def test_bulk_rows_never_include_another_household(intruder_client, victim_data):
    rows = intruder_client.get("/api/snapshots/bulk/?month=2026-01-01").json()

    assert rows == []
