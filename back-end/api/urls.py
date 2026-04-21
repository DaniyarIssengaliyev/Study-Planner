from django.urls import path

from .views import (
    BoardDetailAPIView,
    BoardListCreateAPIView,
    FacultyListAPIView,
    GoogleLoginAPIView,
    LoginAPIView,
    MeAPIView,
    NoteListAPIView,
    RegisterAPIView,
    StudySessionListAPIView,
    SubjectDetailAPIView,
    SubjectListCreateAPIView,
    SubtaskDetailAPIView,
    SubtaskListCreateAPIView,
    TaskDetailAPIView,
    TaskListCreateAPIView,
    subject_summary,
    task_list_simple,
)

urlpatterns = [
    path('auth/register/', RegisterAPIView.as_view(), name='register'),
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/google/', GoogleLoginAPIView.as_view(), name='google-login'),
    path('auth/me/', MeAPIView.as_view(), name='me'),

    path('faculties/', FacultyListAPIView.as_view(), name='faculty-list'),

    path('boards/', BoardListCreateAPIView.as_view(), name='board-list-create'),
    path('boards/<int:pk>/', BoardDetailAPIView.as_view(), name='board-detail'),

    path('tasks/simple/', task_list_simple, name='task-list-simple'),
    path('subjects/summary/', subject_summary, name='subject-summary'),

    path('subjects/', SubjectListCreateAPIView.as_view(), name='subject-list-create'),
    path('subjects/<int:pk>/', SubjectDetailAPIView.as_view(), name='subject-detail'),

    path('tasks/', TaskListCreateAPIView.as_view(), name='task-list-create'),
    path('tasks/<int:pk>/', TaskDetailAPIView.as_view(), name='task-detail'),

    path('tasks/<int:task_pk>/subtasks/', SubtaskListCreateAPIView.as_view(), name='subtask-list-create'),
    path('subtasks/<int:pk>/', SubtaskDetailAPIView.as_view(), name='subtask-detail'),

    path('sessions/', StudySessionListAPIView.as_view(), name='session-list'),
    path('notes/', NoteListAPIView.as_view(), name='note-list'),
]
