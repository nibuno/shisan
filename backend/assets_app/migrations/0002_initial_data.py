from django.db import migrations


def add_initial_categories(apps, schema_editor):
    Category = apps.get_model("assets_app", "Category")
    for name in ["現金", "銀行", "NISA", "iDeCo"]:
        Category.objects.get_or_create(name=name)


def remove_initial_categories(apps, schema_editor):
    Category = apps.get_model("assets_app", "Category")
    Category.objects.filter(name__in=["現金", "銀行", "NISA", "iDeCo"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("assets_app", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(add_initial_categories, remove_initial_categories),
    ]
