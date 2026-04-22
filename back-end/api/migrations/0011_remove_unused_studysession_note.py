from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_subject_faculty'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Note',
        ),
        migrations.DeleteModel(
            name='StudySession',
        ),
    ]
