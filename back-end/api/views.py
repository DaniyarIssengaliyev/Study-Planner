import secrets

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Faculty, Note, Profile, StudySession, Subject, Subtask, Task
from .serializers import (
    CustomTokenObtainPairSerializer,
    FacultySerializer,
    GoogleLoginSerializer,
    NoteModelSerializer,
    RegisterSerializer,
    StudySessionModelSerializer,
    SubjectModelSerializer,
    SubjectSummarySerializer,
    SubtaskSerializer,
    TaskModelSerializer,
    TaskSimpleSerializer,
    UserSerializer,
)


def get_user_role(user):
    if user.is_superuser:
        return 'superadmin'
    return getattr(user.profile, 'role', 'student')


def get_task_for_user(request, pk):
    task = get_object_or_404(Task.objects.select_related('subject', 'owner').prefetch_related('subtasks'), pk=pk)

    if get_user_role(request.user) == 'superadmin':
        return task

    if task.owner_id != request.user.id:
        return None

    return task


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginAPIView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class GoogleLoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        credential = serializer.validated_data['credential']

        try:
            google_user = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError:
            return Response(
                {'detail': 'Invalid Google token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_sub = google_user.get('sub')
        email = google_user.get('email')
        name = google_user.get('name') or email
        email_verified = google_user.get('email_verified', False)

        if not google_sub or not email or not email_verified:
            return Response(
                {'detail': 'Google account data is incomplete.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = Profile.objects.filter(google_sub=google_sub).select_related('user').first()

        if profile:
            user = profile.user
        else:
            user = User.objects.filter(email=email).first()

            if not user:
                base_username = email.split('@')[0]
                username = base_username

                while User.objects.filter(username=username).exists():
                    username = f'{base_username}_{secrets.token_hex(3)}'

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=secrets.token_urlsafe(24),
                )

            profile = user.profile
            profile.google_sub = google_sub
            profile.full_name = name
            profile.save()

        refresh = RefreshToken.for_user(user)
        refresh['username'] = user.username
        refresh['role'] = get_user_role(user)

        access_token = refresh.access_token
        access_token['username'] = user.username
        access_token['role'] = get_user_role(user)

        return Response(
            {
                'refresh': str(refresh),
                'access': str(access_token),
                'user': UserSerializer(user).data,
            }
        )


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class FacultyListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        faculties = Faculty.objects.all().order_by('name')
        serializer = FacultySerializer(faculties, many=True)
        return Response(serializer.data)


@api_view(['GET'])
def task_list_simple(request):
    if request.user.is_authenticated and get_user_role(request.user) != 'superadmin':
        tasks = Task.objects.filter(owner=request.user)
    else:
        tasks = Task.objects.all()

    serializer = TaskSimpleSerializer(tasks, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def subject_summary(request):
    subjects = Subject.objects.annotate(tasks_count=Count('tasks'))
    data = [
        {
            'id': subject.id,
            'name': subject.name,
            'tasks_count': subject.tasks_count,
        }
        for subject in subjects
    ]
    serializer = SubjectSummarySerializer(data, many=True)
    return Response(serializer.data)


def update_overdue_tasks():
    tasks = Task.objects.filter(status__in=['todo', 'in_progress'])
    for task in tasks:
        if task.due_date < timezone.localdate():
            task.status = 'overdue'
            task.save(update_fields=['status'])


class SubjectListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subjects = Subject.objects.all().order_by('name')
        serializer = SubjectModelSerializer(subjects, many=True)
        return Response(serializer.data)

    def post(self, request):
        if get_user_role(request.user) != 'superadmin':
            return Response(
                {'detail': 'Only superadmin can add subjects.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SubjectModelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubjectDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if get_user_role(request.user) != 'superadmin':
            return Response(
                {'detail': 'Only superadmin can delete subjects.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        subject = get_object_or_404(Subject, pk=pk)
        subject.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        update_overdue_tasks()

        if get_user_role(request.user) == 'superadmin':
            tasks = Task.objects.all().select_related('subject', 'owner').prefetch_related('subtasks')
        else:
            tasks = Task.objects.filter(owner=request.user).select_related('subject', 'owner').prefetch_related('subtasks')

        serializer = TaskModelSerializer(tasks, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TaskModelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        update_overdue_tasks()
        task = get_task_for_user(request, pk)

        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TaskModelSerializer(task)
        return Response(serializer.data)

    def put(self, request, pk):
        task = get_task_for_user(request, pk)

        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TaskModelSerializer(task, data=request.data)
        if serializer.is_valid():
            serializer.save(owner=task.owner)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        task = get_task_for_user(request, pk)

        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubtaskListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, task_pk):
        task = get_task_for_user(request, task_pk)

        if task is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubtaskSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(task=task, order=task.subtasks.count())
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubtaskDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        subtask = get_object_or_404(Subtask.objects.select_related('task__owner', 'task__subject'), pk=pk)

        if get_user_role(request.user) == 'superadmin':
            return subtask

        if subtask.task.owner_id != request.user.id:
            return None

        return subtask

    def put(self, request, pk):
        subtask = self.get_object(request, pk)

        if subtask is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubtaskSerializer(subtask, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(task=subtask.task)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        subtask = self.get_object(request, pk)

        if subtask is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        subtask.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudySessionListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = StudySession.objects.all()
        serializer = StudySessionModelSerializer(sessions, many=True)
        return Response(serializer.data)


class NoteListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notes = Note.objects.all()
        serializer = NoteModelSerializer(notes, many=True)
        return Response(serializer.data)
