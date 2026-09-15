import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Owner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, verbose_name="名前")),
            ],
            options={"verbose_name": "名義人", "verbose_name_plural": "名義人"},
        ),
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True, verbose_name="カテゴリ名")),
            ],
            options={"verbose_name": "カテゴリ", "verbose_name_plural": "カテゴリ"},
        ),
        migrations.CreateModel(
            name="Asset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, verbose_name="資産名")),
                ("purpose", models.CharField(blank=True, max_length=200, verbose_name="用途")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assets", to="assets_app.owner")),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assets", to="assets_app.category")),
            ],
            options={"verbose_name": "資産", "verbose_name_plural": "資産"},
        ),
        migrations.CreateModel(
            name="BalanceSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("month", models.DateField(db_index=True, verbose_name="月")),
                ("balance", models.DecimalField(decimal_places=2, max_digits=14, verbose_name="残高")),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="snapshots", to="assets_app.asset")),
            ],
            options={"verbose_name": "月次残高", "verbose_name_plural": "月次残高", "ordering": ["-month"]},
        ),
        migrations.AlterUniqueTogether(
            name="balancesnapshot",
            unique_together={("asset", "month")},
        ),
    ]
