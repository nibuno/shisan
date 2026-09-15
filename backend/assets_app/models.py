import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def default_invitation_expiry():
    return timezone.now() + timedelta(days=INVITATION_LIFETIME_DAYS)


INVITATION_LIFETIME_DAYS = 7


class Household(models.Model):
    """A tenant. Every Owner, Category, and Asset belongs to exactly one."""

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "世帯"
        verbose_name_plural = "世帯"


class Membership(models.Model):
    """Grants a user access to a household, so a couple can share one."""

    OWNER = "owner"
    MEMBER = "member"
    ROLE_CHOICES = [(OWNER, "管理者"), (MEMBER, "メンバー")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="members"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.household}"

    class Meta:
        verbose_name = "世帯メンバー"
        verbose_name_plural = "世帯メンバー"
        unique_together = [("user", "household")]


class Invitation(models.Model):
    """A single-use ticket to join one household.

    The token is the authorisation, which is what lets registration stay closed
    while still admitting the people a member actually invites.
    """

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="invitations"
    )
    token = models.CharField(
        max_length=64, unique=True, default=generate_invitation_token, db_index=True
    )
    role = models.CharField(
        max_length=20, choices=Membership.ROLE_CHOICES, default=Membership.MEMBER
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invitations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_invitation_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)

    def is_usable(self) -> bool:
        return self.accepted_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.household} への招待"

    class Meta:
        verbose_name = "招待"
        verbose_name_plural = "招待"
        ordering = ["-created_at"]


class Owner(models.Model):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="owners"
    )
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "名義人"
        verbose_name_plural = "名義人"


class Category(models.Model):
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "カテゴリ"
        verbose_name_plural = "カテゴリ"
        unique_together = [("household", "name")]


class Asset(models.Model):
    # BalanceSnapshot deliberately has no household column: it reaches the
    # tenant through asset, so there is no denormalised copy to drift.
    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="assets"
    )
    owner = models.ForeignKey(Owner, on_delete=models.PROTECT, related_name="assets")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="assets")
    name = models.CharField(max_length=200)
    purpose = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "資産"
        verbose_name_plural = "資産"


class BalanceSnapshot(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="snapshots")
    month = models.DateField(db_index=True)  # always stored as YYYY-MM-01
    balance = models.DecimalField(max_digits=14, decimal_places=2)

    def __str__(self):
        return f"{self.asset.name} - {self.month}"

    class Meta:
        verbose_name = "月次残高"
        verbose_name_plural = "月次残高"
        unique_together = [("asset", "month")]
        ordering = ["-month"]
