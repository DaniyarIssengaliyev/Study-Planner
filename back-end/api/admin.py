from django.contrib import admin
from .models import Subject, Task, StudySession, Note


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'color')
    search_fields = ('name',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'subject', 'status', 'priority', 'due_date')
    list_filter = ('status', 'priority', 'subject')
    search_fields = ('title', 'description')


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'topic', 'subject', 'session_date', 'duration_minutes')
    list_filter = ('subject', 'session_date')


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('id', 'task', 'created_at')
    search_fields = ('content',)
