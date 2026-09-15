from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from assets_app.models import Household, Membership
from assets_app.services import household_create


class Command(BaseCommand):
    help = (
        "Create a household and make an existing user its owner. "
        "Self-hosters run this once after createsuperuser; without a household "
        "a user can log in but reaches no data."
    )

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True, help="Household name")
        parser.add_argument(
            "--username", required=True, help="Existing user to make the owner"
        )

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            user = User.objects.get(username=options["username"])
        except User.DoesNotExist as exc:
            raise CommandError(
                f"User '{options['username']}' does not exist. "
                "Create it first with: python manage.py createsuperuser"
            ) from exc

        existing = Household.objects.filter(members__user=user).first()
        if existing is not None:
            raise CommandError(
                f"User '{user.get_username()}' already belongs to '{existing.name}'."
            )

        household = household_create(name=options["name"], user=user)

        self.stdout.write(
            self.style.SUCCESS(
                f"Created household '{household.name}' with "
                f"{household.categories.count()} default categories, "
                f"owned by '{user.get_username()}'."
            )
        )
        assert Membership.objects.filter(user=user, household=household).exists()
