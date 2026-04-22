from django.contrib import admin
from .models import Subject, Task, TaskActivity


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'color')
    search_fields = ('name',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'subject', 'status', 'priority', 'due_date')
    list_filter = ('status', 'priority', 'subject')
    search_fields = ('title', 'description')


@admin.register(TaskActivity)
class TaskActivityAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'event_type', 'created_at')
    list_filter = ('event_type', 'created_at')
    search_fields = ('task__title', 'message')
