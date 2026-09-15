from django.conf import settings
from django.urls import path
from ninja import NinjaAPI

from assets_app.api.analytics import router as analytics_router
from assets_app.api.assets import router as assets_router
from assets_app.api.auth import router as auth_router
from assets_app.api.categories import router as categories_router
from assets_app.api.errors import register_exception_handlers
from assets_app.api.health import router as health_router
from assets_app.api.invitations import router as invitations_router
from assets_app.api.owners import router as owners_router
from assets_app.api.security import csrf_session_auth
from assets_app.api.snapshots import router as snapshots_router

api = NinjaAPI(
    title="家庭資産管理 API",
    version="1.0.0",
    description="家庭の資産を管理するための REST API",
    docs_url=None if settings.IS_PRODUCTION else "/docs",
    openapi_url=None if settings.IS_PRODUCTION else "/openapi.json",
)

register_exception_handlers(api)

api.add_router("/health", health_router, tags=["ヘルスチェック"])
api.add_router("/auth", auth_router, tags=["認証"])
api.add_router("/owners", owners_router, tags=["名義人"], auth=csrf_session_auth)
api.add_router("/categories", categories_router, tags=["カテゴリ"], auth=csrf_session_auth)
api.add_router("/assets", assets_router, tags=["資産"], auth=csrf_session_auth)
api.add_router("/snapshots", snapshots_router, tags=["月次残高"], auth=csrf_session_auth)
api.add_router("/analytics", analytics_router, tags=["集計"], auth=csrf_session_auth)
api.add_router(
    "/invitations", invitations_router, tags=["招待"], auth=csrf_session_auth
)

urlpatterns = [
    path("api/", api.urls),
]
