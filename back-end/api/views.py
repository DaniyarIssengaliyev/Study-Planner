from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Subject, Task, StudySession, Note, Faculty
from .serializers import (
    CustomTokenObtainPairSerializer,
    FacultySerializer,
    RegisterSerializer,
    SubjectModelSerializer,
    SubjectSummarySerializer,
    TaskModelSerializer,
    TaskSimpleSerializer,
    StudySessionModelSerializer,
    NoteModelSerializer,
    UserSerializer,
)


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
    def get(self, request):
        subjects = Subject.objects.all()
        serializer = SubjectModelSerializer(subjects, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = SubjectModelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskListCreateAPIView(APIView):
    def get(self, request):
        update_overdue_tasks()
        tasks = Task.objects.all()
        serializer = TaskModelSerializer(tasks, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TaskModelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskDetailAPIView(APIView):
    def get_object(self, pk):
        return get_object_or_404(Task, pk=pk)

    def get(self, request, pk):
        update_overdue_tasks()
        task = self.get_object(pk)
        serializer = TaskModelSerializer(task)
        return Response(serializer.data)

    def put(self, request, pk):
        task = self.get_object(pk)
        serializer = TaskModelSerializer(task, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        task = self.get_object(pk)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudySessionListAPIView(APIView):
    def get(self, request):
        sessions = StudySession.objects.all()
        serializer = StudySessionModelSerializer(sessions, many=True)
        return Response(serializer.data)


class NoteListAPIView(APIView):
    def get(self, request):
        notes = Note.objects.all()
        serializer = NoteModelSerializer(notes, many=True)
        return Response(serializer.data)
