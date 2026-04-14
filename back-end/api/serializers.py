from rest_framework import serializers
from .models import Subject, Task, StudySession, Note

class TaskSimpleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(max_length=200)
    status = serializers.CharField(max_length=20)

class SubjectSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=100)
    tasks_count = serializers.IntegerField()


class SubjectModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'


class TaskModelSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'due_date', 'status', 'priority', 'subject', 'subject_name']


class StudySessionModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = '__all__'


class NoteModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = '__all__'