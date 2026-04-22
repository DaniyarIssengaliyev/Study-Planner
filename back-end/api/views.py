import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Count, Q
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
    FacultyOverviewSerializer,
    GoogleLoginSerializer,
    NoteModelSerializer,
    ProfileSettingsSerializer,
    RegisterSerializer,
    StudySessionModelSerializer,
    SubjectModelSerializer,
    SubjectSummarySerializer,
    StudentSummarySerializer,
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
    return Board.objects.filter(owner=user).select_related('subject', 'subject__faculty', 'owner')


def get_task_queryset_for_user(user):
    return Task.objects.filter(owner=user).select_related(
        'subject',
        'subject__faculty',
        'owner',
        'board',
        'board__subject',
        'board__subject__faculty',
    ).prefetch_related('subtasks', 'activity_log')


def get_user_faculty_id(user):
    if not user.is_authenticated or user.is_superuser:
        return None
    return getattr(user.profile, 'faculty_id', None)


def can_use_subject(user, subject):
    if user.is_superuser:
        return True

    user_faculty_id = get_user_faculty_id(user)
    return bool(user_faculty_id and subject.faculty_id == user_faculty_id)


def subject_permission_error():
    return Response(
        {'detail': 'You can only use subjects from your own faculty.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


def build_deadline_buckets(tasks_queryset):
    start_of_today = timezone.localdate()
    buckets = []
    due_dates = list(tasks_queryset.exclude(status='completed').values_list('due_date', flat=True))

    for index in range(7):
        target_date = start_of_today + timedelta(days=index)
        value = sum(
            1
            for due_date in due_dates
            if due_date and timezone.localtime(due_date).date() == target_date
        )

        buckets.append(
            {
                'label': target_date.isoformat(),
                'value': value,
            }
        )

    return buckets


def build_subject_load(tasks_queryset):
    return list(
        tasks_queryset.values('subject__name')
        .annotate(value=Count('id'))
        .order_by('-value', 'subject__name')[:6]
    )


def get_task_for_user(request, pk):
    task = get_object_or_404(
        Task.objects.select_related('subject', 'owner', 'board').prefetch_related('subtasks', 'activity_log'),
        pk=pk,
    )

    if task.owner_id != request.user.id:
        return None

    return task


def get_board_for_user(request, pk):
    board = get_object_or_404(Board.objects.select_related('subject', 'owner'), pk=pk)

    if board.owner_id != request.user.id:
        return None

    return board


@api_view(['GET'])
def student_summary(request):
    if get_user_role(request.user) != 'superadmin':
        return Response({'detail': 'Only superadmin can view student statistics.'}, status=status.HTTP_403_FORBIDDEN)

    students = (
        User.objects.filter(is_superuser=False, profile__role='student')
        .select_related('profile__faculty')
        .annotate(
            boards_count=Count('boards', distinct=True),
            tasks_count=Count('tasks', distinct=True),
            completed_tasks_count=Count('tasks', filter=Q(tasks__status='completed'), distinct=True),
            overdue_tasks_count=Count(
                'tasks',
                filter=Q(tasks__status='overdue') | Q(tasks__status='completed', tasks__completed_at__gt=models.F('tasks__due_date')),
                distinct=True,
            ),
        )
        .order_by('profile__full_name', 'username')
    )

    data = [
        {
            'id': student.id,
            'username': student.username,
            'full_name': student.profile.full_name,
            'faculty_id': student.profile.faculty_id,
            'faculty_name': student.profile.faculty.name if student.profile.faculty else None,
            'boards_count': student.boards_count,
            'tasks_count': student.tasks_count,
            'completed_tasks_count': student.completed_tasks_count,
            'overdue_tasks_count': student.overdue_tasks_count,
        }
        for student in students
    ]

    serializer = StudentSummarySerializer(data, many=True)
    return Response(serializer.data)


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


class ProfileSettingsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = ProfileSettingsSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


class FacultyListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        faculties = Faculty.objects.all().order_by('name')
        serializer = FacultySerializer(faculties, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_authenticated or get_user_role(request.user) != 'superadmin':
            return Response(
                {'detail': 'Only superadmin can add faculties.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = FacultySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FacultyOverviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Faculty.objects.all().order_by('name')
        user_role = get_user_role(request.user)

        if user_role != 'superadmin':
            faculty_id = get_user_faculty_id(request.user)
            if not faculty_id:
                return Response([], status=status.HTTP_200_OK)
            queryset = queryset.filter(pk=faculty_id)

        faculties = list(queryset.prefetch_related('subjects'))
        students_queryset = User.objects.filter(
            is_superuser=False,
            profile__role='student',
            profile__faculty__in=faculties,
        )

        if user_role == 'superadmin':
            students_queryset = (
                students_queryset.select_related('profile__faculty')
                .annotate(
                    boards_count=Count('boards', distinct=True),
                    tasks_count=Count('tasks', distinct=True),
                    completed_tasks_count=Count('tasks', filter=Q(tasks__status='completed'), distinct=True),
                    overdue_tasks_count=Count(
                        'tasks',
                        filter=Q(tasks__status='overdue') | Q(tasks__status='completed', tasks__completed_at__gt=models.F('tasks__due_date')),
                        distinct=True,
                    ),
                )
                .order_by('profile__full_name', 'username')
            )
        else:
            students_queryset = students_queryset.select_related('profile__faculty').order_by(
                'profile__full_name',
                'username',
            )

        students_by_faculty_id = {}
        for student in students_queryset:
            students_by_faculty_id.setdefault(student.profile.faculty_id, []).append(
                {
                    'id': student.id,
                    'username': student.username,
                    'full_name': student.profile.full_name,
                    'faculty_id': student.profile.faculty_id,
                    'faculty_name': student.profile.faculty.name if student.profile.faculty else None,
                    'boards_count': getattr(student, 'boards_count', None),
                    'tasks_count': getattr(student, 'tasks_count', None),
                    'completed_tasks_count': getattr(student, 'completed_tasks_count', None),
                    'overdue_tasks_count': getattr(student, 'overdue_tasks_count', None),
                }
            )

        data = [
            {
                'id': faculty.id,
                'name': faculty.name,
                'subjects': SubjectModelSerializer(
                    faculty.subjects.all().order_by('name'),
                    many=True,
                ).data,
                'students': students_by_faculty_id.get(faculty.id, []),
                'analytics': self.build_faculty_analytics(faculty),
            }
            for faculty in faculties
        ]

        return Response(data)

    def build_faculty_analytics(self, faculty):
        tasks_queryset = Task.objects.filter(
            owner__is_superuser=False,
            owner__profile__role='student',
            owner__profile__faculty_id=faculty.id,
        ).select_related('subject')

        total_tasks = tasks_queryset.count()
        completed_tasks = tasks_queryset.filter(status='completed').count()
        in_progress_tasks = tasks_queryset.filter(status='in_progress').count()
        overdue_tasks = tasks_queryset.filter(status='overdue').count()
        todo_tasks = tasks_queryset.filter(status='todo').count()

        return {
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'in_progress_tasks': in_progress_tasks,
            'overdue_tasks': overdue_tasks,
            'todo_tasks': todo_tasks,
            'completion_rate': round((completed_tasks / total_tasks) * 100) if total_tasks else 0,
            'subject_load': [
                {
                    'name': item['subject__name'] or 'Unknown subject',
                    'value': item['value'],
                }
                for item in build_subject_load(tasks_queryset)
            ],
            'deadline_buckets': build_deadline_buckets(tasks_queryset),
        }


class FacultyDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        if get_user_role(request.user) != 'superadmin':
            return Response(
                {'detail': 'Only superadmin can delete faculties.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        faculty = get_object_or_404(Faculty, pk=pk)
        faculty.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BoardListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = get_board_queryset_for_user(request.user).order_by('title', 'id')
        serializer = BoardModelSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BoardModelSerializer(data=request.data)
        if serializer.is_valid():
            subject = serializer.validated_data.get('subject')
            if subject and not can_use_subject(request.user, subject):
                return subject_permission_error()
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
            subject = serializer.validated_data.get('subject')
            if subject and not can_use_subject(request.user, subject):
                return subject_permission_error()
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
    subjects = Subject.objects.select_related('faculty').annotate(tasks_count=Count('tasks'))
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
        subjects = Subject.objects.select_related('faculty')

        if get_user_role(request.user) != 'superadmin':
            faculty_id = get_user_faculty_id(request.user)
            if faculty_id:
                subjects = subjects.filter(faculty_id=faculty_id)
            else:
                subjects = subjects.none()

        subjects = subjects.order_by('faculty__name', 'name')
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
            subject = serializer.validated_data['subject']
            if not can_use_subject(request.user, subject):
                return subject_permission_error()
            board = serializer.validated_data.get('board')
            if board and board.owner_id != request.user.id:
                return Response(
                    {'detail': 'You can only attach tasks to your own boards.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if board and board.subject_id and board.subject_id != subject.id:
                return Response(
                    {'detail': 'Board subject does not match selected subject.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
            subject = serializer.validated_data.get('subject', task.subject)
            if not can_use_subject(request.user, subject):
                return subject_permission_error()
            board = serializer.validated_data.get('board')
            if board and board.owner_id != request.user.id:
                return Response(
                    {'detail': 'You can only attach tasks to your own boards.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if board and board.subject_id and board.subject_id != subject.id:
                return Response(
                    {'detail': 'Board subject does not match selected subject.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
