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

from .models import Board, Faculty, Note, Profile, StudySession, Subject, Subtask, Task, TaskActivity
from .serializers import (
    BoardModelSerializer,
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


def get_board_queryset_for_user(user):
    if get_user_role(user) == 'superadmin':
        return Board.objects.all().select_related('subject', 'owner')
    return Board.objects.filter(owner=user).select_related('subject', 'owner')


def get_task_queryset_for_user(user):
    if get_user_role(user) == 'superadmin':
        return Task.objects.all().select_related('subject', 'owner', 'board').prefetch_related('subtasks', 'activity_log')
    return Task.objects.filter(owner=user).select_related('subject', 'owner', 'board').prefetch_related('subtasks', 'activity_log')


def get_task_for_user(request, pk):
    task = get_object_or_404(
        Task.objects.select_related('subject', 'owner', 'board').prefetch_related('subtasks', 'activity_log'),
        pk=pk,
    )

    if get_user_role(request.user) == 'superadmin':
        return task

    if task.owner_id != request.user.id:
        return None

    return task


def get_board_for_user(request, pk):
    board = get_object_or_404(Board.objects.select_related('subject', 'owner'), pk=pk)

    if get_user_role(request.user) == 'superadmin':
        return board

    if board.owner_id != request.user.id:
        return None

    return board


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


class BoardListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = get_board_queryset_for_user(request.user).order_by('title', 'id')
        serializer = BoardModelSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BoardModelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BoardDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        board = get_board_for_user(request, pk)
        if board is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BoardModelSerializer(board)
        return Response(serializer.data)

    def put(self, request, pk):
        board = get_board_for_user(request, pk)
        if board is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BoardModelSerializer(board, data=request.data)
        if serializer.is_valid():
            serializer.save(owner=board.owner)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        board = get_board_for_user(request, pk)
        if board is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        board.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
      if task.due_date < timezone.now():
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
        queryset = get_task_queryset_for_user(request.user)

        board_id = request.query_params.get('board')
        if board_id:
            queryset = queryset.filter(board_id=board_id)

        serializer = TaskModelSerializer(queryset.order_by('-id'), many=True)
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

        previous_status = task.status
        serializer = TaskModelSerializer(task, data=request.data)
        if serializer.is_valid():
            updated_task = serializer.save(owner=task.owner)

            if previous_status != updated_task.status:
                if updated_task.status == 'completed':
                    updated_task.completed_at = timezone.now()
                    updated_task.save(update_fields=['completed_at'])
                    TaskActivity.objects.create(
                        task=updated_task,
                        event_type='task_completed',
                        message='Task marked as completed.',
                    )
                elif previous_status == 'completed' and updated_task.status != 'completed':
                    updated_task.completed_at = None
                    updated_task.save(update_fields=['completed_at'])
                    TaskActivity.objects.create(
                        task=updated_task,
                        event_type='task_reopened',
                        message='Task moved back to active work.',
                    )

            return Response(TaskModelSerializer(updated_task).data)
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

        previous_completed = subtask.is_completed
        serializer = SubtaskSerializer(subtask, data=request.data, partial=True)
        if serializer.is_valid():
            updated_subtask = serializer.save(task=subtask.task)

            if previous_completed != updated_subtask.is_completed:
                if updated_subtask.is_completed:
                    updated_subtask.completed_at = timezone.now()
                    updated_subtask.save(update_fields=['completed_at'])
                    TaskActivity.objects.create(
                        task=updated_subtask.task,
                        subtask=updated_subtask,
                        event_type='subtask_completed',
                        message=f'Subtask completed: {updated_subtask.title}',
                    )
                else:
                    updated_subtask.completed_at = None
                    updated_subtask.save(update_fields=['completed_at'])
                    TaskActivity.objects.create(
                        task=updated_subtask.task,
                        subtask=updated_subtask,
                        event_type='subtask_reopened',
                        message=f'Subtask reopened: {updated_subtask.title}',
                    )

            return Response(SubtaskSerializer(updated_subtask).data)
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
