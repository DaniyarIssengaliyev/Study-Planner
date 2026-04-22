from django.urls import path

from .views import (
    BoardDetailAPIView,
    BoardListCreateAPIView,
    FacultyDetailAPIView,
    FacultyListAPIView,
    GoogleLoginAPIView,
    LoginAPIView,
    MeAPIView,
    ProfileSettingsAPIView,
    RegisterAPIView,
    SubjectDetailAPIView,
    SubjectListCreateAPIView,
    SubtaskDetailAPIView,
    SubtaskListCreateAPIView,
    TaskDetailAPIView,
    TaskListCreateAPIView,
    student_summary,
    FacultyOverviewAPIView,
)

urlpatterns = [
    path('auth/register/', RegisterAPIView.as_view(), name='register'),
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/google/', GoogleLoginAPIView.as_view(), name='google-login'),
    path('auth/me/', MeAPIView.as_view(), name='me'),
    path('auth/profile/settings/', ProfileSettingsAPIView.as_view(), name='profile-settings'),

    path('faculties/', FacultyListAPIView.as_view(), name='faculty-list'),
    path('faculties/overview/', FacultyOverviewAPIView.as_view(), name='faculty-overview'),
    path('faculties/<int:pk>/', FacultyDetailAPIView.as_view(), name='faculty-detail'),

    path('boards/', BoardListCreateAPIView.as_view(), name='board-list-create'),
    path('boards/<int:pk>/', BoardDetailAPIView.as_view(), name='board-detail'),

    path('students/summary/', student_summary, name='student-summary'),

    path('subjects/', SubjectListCreateAPIView.as_view(), name='subject-list-create'),
    path('subjects/<int:pk>/', SubjectDetailAPIView.as_view(), name='subject-detail'),

    path('tasks/', TaskListCreateAPIView.as_view(), name='task-list-create'),
    path('tasks/<int:pk>/', TaskDetailAPIView.as_view(), name='task-detail'),

    path('tasks/<int:task_pk>/subtasks/', SubtaskListCreateAPIView.as_view(), name='subtask-list-create'),
    path('subtasks/<int:pk>/', SubtaskDetailAPIView.as_view(), name='subtask-detail'),

]
