from django.shortcuts import render
from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView

from .models import Subject, Task, StudySession, Note
from .serializers import (
    TaskSimpleSerializer,
    SubjectSummarySerializer,
    SubjectModelSerializer,
    TaskModelSerializer,
    StudySessionModelSerializer,
    NoteModelSerializer,
)

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
        return Task.objects.get(pk=pk)

    def get(self, request, pk):
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