from django.middleware.csrf import CsrfViewMiddleware
from ninja.errors import HttpError
from ninja.security import SessionAuth

from assets_app.models import Household

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def enforce_csrf(request) -> None:
    if request.method in SAFE_METHODS:
        return

    response = CsrfViewMiddleware(lambda req: None).process_view(
        request,
        lambda req: None,
        (),
        {},
    )
    if response is not None:
        raise HttpError(403, "CSRF verification failed")


def resolve_household(user) -> Household:
    """The single place a request's tenant is decided.

    Everything downstream takes the household this returns as a required
    argument, so no query can quietly fall back to an unscoped manager.
    """
    household = Household.objects.filter(members__user=user).order_by("id").first()
    if household is None:
        raise HttpError(403, "所属する世帯がありません")
    return household


class CsrfSessionAuth(SessionAuth):
    def authenticate(self, request, key):
        user = super().authenticate(request, key)
        if user is None:
            return None
        enforce_csrf(request)
        request.household = resolve_household(user)
        return user


csrf_session_auth = CsrfSessionAuth()
