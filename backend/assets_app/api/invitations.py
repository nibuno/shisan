from ninja import Router

from assets_app.models import Invitation
from assets_app.schemas import InvitationCreateIn, InvitationOut
from assets_app.services import invitation_create, invitation_revoke

router = Router()


@router.get("/", response=list[InvitationOut])
def list_invitations(request):
    return list(
        Invitation.objects.filter(household=request.household, accepted_at__isnull=True)
    )


@router.post("/", response=InvitationOut)
def create_invitation(request, payload: InvitationCreateIn):
    return invitation_create(
        household=request.household, created_by=request.user, role=payload.role
    )


@router.delete("/{invitation_id}")
def delete_invitation(request, invitation_id: int):
    invitation_revoke(household=request.household, invitation_id=invitation_id)
    return {"success": True}
