from django.urls import path
from .views import (
    task_list_simple,
    subject_summary,
    SubjectListCreateAPIView,
    TaskListCreateAPIView,
    TaskDetailAPIView,
    StudySessionListAPIView,
    NoteListAPIView,
)

urlpatterns = [
    path('tasks/simple/', task_list_simple, name='task-list-simple'),
    path('subjects/summary/', subject_summary, name='subject-summary'),

    path('subjects/', SubjectListCreateAPIView.as_view(), name='subject-list-create'),
    path('tasks/', TaskListCreateAPIView.as_view(), name='task-list-create'),
    path('tasks/<int:pk>/', TaskDetailAPIView.as_view(), name='task-detail'),
    path('sessions/', StudySessionListAPIView.as_view(), name='session-list'),
    path('notes/', NoteListAPIView.as_view(), name='note-list'),
]
