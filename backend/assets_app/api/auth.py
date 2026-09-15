from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.middleware.csrf import get_token
from ninja import Router

from assets_app.api.security import enforce_csrf
from assets_app.schemas import (
    AuthStatusOut,
    InvitationAcceptIn,
    InvitationInfoOut,
    LoginIn,
    SignupIn,
    UserOut,
)
from assets_app.services import (
    household_create,
    invitation_accept,
    invitation_for_token,
)

router = Router()


def _auth_status(request) -> AuthStatusOut:
    if not request.user.is_authenticated:
        return AuthStatusOut(authenticated=False, user=None)
    return AuthStatusOut(
        authenticated=True,
        user=UserOut(id=request.user.id, username=request.user.get_username()),
    )


@router.get("/csrf/", response=AuthStatusOut)
def csrf(request):
    get_token(request)
    return _auth_status(request)


@router.get("/me/", response=AuthStatusOut)
def me(request):
    return _auth_status(request)


@router.post("/login/", response={200: AuthStatusOut, 400: dict[str, str]})
def login_view(request, payload: LoginIn):
    enforce_csrf(request)
    user = authenticate(
        request,
        username=payload.username,
        password=payload.password,
    )
    if user is None:
        return 400, {"detail": "ユーザー名またはパスワードが違います"}

    login(request, user)
    return _auth_status(request)


@router.post("/signup/", response={200: AuthStatusOut, 400: dict[str, str], 403: dict[str, str]})
def signup(request, payload: SignupIn):
    """Register a user and give them a household in one step.

    A user without a household can log in and then reach nothing, so the two
    are created together rather than leaving an account stranded.
    """
    enforce_csrf(request)

    if not settings.ALLOW_SIGNUP:
        return 403, {"detail": "このインスタンスでは新規登録を受け付けていません"}

    username = payload.username.strip()
    household_name = payload.household_name.strip()
    if not username or not household_name:
        return 400, {"detail": "ユーザー名と世帯名を入力してください"}

    User = get_user_model()
    try:
        validate_password(payload.password)
    except ValidationError as exc:
        return 400, {"detail": " ".join(exc.messages)}

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username, password=payload.password
            )
            household_create(name=household_name, user=user)
    except IntegrityError:
        return 400, {"detail": "このユーザー名はすでに使われています"}

    login(request, user)
    return _auth_status(request)


@router.get("/invitation/{token}/", response=InvitationInfoOut)
def invitation_info(request, token: str):
    """Public: lets the invite page name the household before registering."""
    invitation = invitation_for_token(token=token)
    return InvitationInfoOut(household_name=invitation.household.name)


@router.post("/invitation/{token}/accept/", response=AuthStatusOut)
def accept_invitation(request, token: str, payload: InvitationAcceptIn):
    """Public: the token is the authorisation, so ALLOW_SIGNUP does not apply."""
    enforce_csrf(request)
    user = invitation_accept(
        token=token, username=payload.username, password=payload.password
    )
    login(request, user)
    return _auth_status(request)


@router.post("/logout/", response=AuthStatusOut)
def logout_view(request):
    enforce_csrf(request)
    logout(request)
    return _auth_status(request)
