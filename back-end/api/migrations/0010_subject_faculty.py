from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0009_board_task_board'),
    ]

    operations = [
        migrations.AddField(
            model_name='subject',
            name='faculty',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='subjects',
                to='api.faculty',
            ),
        ),
    ]
