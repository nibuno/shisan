from django.db import connection
from ninja import Router

router = Router()


@router.get("/")
def health(request):
    return {"status": "ok"}


@router.get("/db/")
def database_health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return {"status": "ok"}
