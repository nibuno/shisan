from django.db import migrations

DEFAULT_HOUSEHOLD_NAME = "わが家"


def backfill(apps, schema_editor):
    """Move every pre-tenancy row into one household and let existing users in.

    Before this migration any authenticated user could read every row, so the
    data was effectively one household already. Preserve that reading rather
    than guessing at a split.
    """
    Household = apps.get_model("assets_app", "Household")
    Membership = apps.get_model("assets_app", "Membership")
    Owner = apps.get_model("assets_app", "Owner")
    Category = apps.get_model("assets_app", "Category")
    Asset = apps.get_model("assets_app", "Asset")
    User = apps.get_model("auth", "User")

    # 0002 seeds four global categories, so their presence alone does not mean
    # a real install. Look for data only a person could have created.
    has_real_data = (
        Owner.objects.exists() or Asset.objects.exists() or User.objects.exists()
    )
    if not has_real_data:
        # Fresh database: drop the orphaned seed rows. Categories are seeded per
        # household at signup from here on.
        Category.objects.filter(household__isnull=True).delete()
        return

    household = Household.objects.create(name=DEFAULT_HOUSEHOLD_NAME)

    Owner.objects.filter(household__isnull=True).update(household=household)
    Category.objects.filter(household__isnull=True).update(household=household)
    Asset.objects.filter(household__isnull=True).update(household=household)

    for user in User.objects.all():
        Membership.objects.get_or_create(
            user=user, household=household, defaults={"role": "owner"}
        )


def unbackfill(apps, schema_editor):
    Household = apps.get_model("assets_app", "Household")
    Membership = apps.get_model("assets_app", "Membership")
    Owner = apps.get_model("assets_app", "Owner")
    Category = apps.get_model("assets_app", "Category")
    Asset = apps.get_model("assets_app", "Asset")

    Owner.objects.update(household=None)
    Category.objects.update(household=None)
    Asset.objects.update(household=None)
    Membership.objects.all().delete()
    Household.objects.filter(name=DEFAULT_HOUSEHOLD_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("assets_app", "0004_add_household_nullable"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
