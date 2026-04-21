from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0006_subtask'),
    ]

    operations = [
        migrations.AlterField(
            model_name='task',
            name='due_date',
            field=models.DateTimeField(),
        ),
    ]
