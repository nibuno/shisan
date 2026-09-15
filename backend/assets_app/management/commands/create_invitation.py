from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from assets_app.models import Household, Membership
from assets_app.services import invitation_create


class Command(BaseCommand):
    help = (
        "Issue an invitation link for the inviter's household. "
        "Anyone with the link can register into that household once."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--username", required=True, help="An existing member doing the inviting"
        )
        parser.add_argument(
            "--role", default=Membership.MEMBER, choices=[Membership.OWNER, Membership.MEMBER]
        )
        parser.add_argument(
            "--base-url",
            default="http://localhost:8080",
            help="Origin used to print the link",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            user = User.objects.get(username=options["username"])
        except User.DoesNotExist as exc:
            raise CommandError(f"User '{options['username']}' does not exist.") from exc

        household = Household.objects.filter(members__user=user).first()
        if household is None:
            raise CommandError(
                f"User '{user.get_username()}' belongs to no household. "
                "Run create_household first."
            )

        invitation = invitation_create(
            household=household, created_by=user, role=options["role"]
        )
        url = f"{options['base_url'].rstrip('/')}/invite/{invitation.token}"

        self.stdout.write(
            self.style.SUCCESS(f"Invitation to '{household.name}' as {invitation.role}:")
        )
        self.stdout.write(url)
        self.stdout.write(
            f"Valid until {invitation.expires_at:%Y-%m-%d %H:%M}. Single use."
        )
