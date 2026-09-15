from django.core.exceptions import ObjectDoesNotExist, ValidationError
from ninja import NinjaAPI

from assets_app.exceptions import ApplicationError


def register_exception_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(ObjectDoesNotExist)
    def object_does_not_exist_handler(request, exc):
        return api.create_response(
            request,
            {"detail": "対象のデータが見つかりません"},
            status=404,
        )

    @api.exception_handler(ApplicationError)
    def application_error_handler(request, exc):
        return api.create_response(request, {"detail": str(exc)}, status=400)

    @api.exception_handler(ValidationError)
    def validation_error_handler(request, exc):
        return api.create_response(
            request,
            {"detail": "; ".join(exc.messages)},
            status=400,
        )
