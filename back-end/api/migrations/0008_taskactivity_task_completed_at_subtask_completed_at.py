from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0007_alter_task_due_date'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='subtask',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='TaskActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('task_completed', 'Task completed'), ('task_reopened', 'Task reopened'), ('subtask_completed', 'Subtask completed'), ('subtask_reopened', 'Subtask reopened')], max_length=30)),
                ('message', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('subtask', models.ForeignKey(blank=True, null=True, on_delete=models.CASCADE, related_name='activity_log', to='api.subtask')),
                ('task', models.ForeignKey(on_delete=models.CASCADE, related_name='activity_log', to='api.task')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
    ]
