from django.urls import path

from .views import (
    FacultyListAPIView,
    LoginAPIView,
    MeAPIView,
    NoteListAPIView,
    RegisterAPIView,
    StudySessionListAPIView,
    SubjectListCreateAPIView,
    TaskDetailAPIView,
    TaskListCreateAPIView,
    subject_summary,
    task_list_simple,
)

urlpatterns = [
    path('auth/register/', RegisterAPIView.as_view(), name='register'),
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/me/', MeAPIView.as_view(), name='me'),
    path('faculties/', FacultyListAPIView.as_view(), name='faculty-list'),

    path('tasks/simple/', task_list_simple, name='task-list-simple'),
    path('subjects/summary/', subject_summary, name='subject-summary'),

    path('subjects/', SubjectListCreateAPIView.as_view(), name='subject-list-create'),
    path('tasks/', TaskListCreateAPIView.as_view(), name='task-list-create'),
    path('tasks/<int:pk>/', TaskDetailAPIView.as_view(), name='task-detail'),
    path('sessions/', StudySessionListAPIView.as_view(), name='session-list'),
    path('notes/', NoteListAPIView.as_view(), name='note-list'),
]
