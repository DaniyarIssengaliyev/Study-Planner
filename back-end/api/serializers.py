from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Board, Faculty, Note, Profile, StudySession, Subject, Subtask, Task, TaskActivity


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ['id', 'name']


class ProfileSerializer(serializers.ModelSerializer):
    faculty = FacultySerializer(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['full_name', 'role', 'faculty', 'google_sub']

    def get_role(self, obj):
        return obj.effective_role


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True)
    faculty_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'full_name', 'faculty_id']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('User with this username already exists.')
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError('User with this email already exists.')
        return value

    def create(self, validated_data):
        full_name = validated_data.pop('full_name')
        faculty_id = validated_data.pop('faculty_id', None)

        user = User.objects.create_user(**validated_data)
        user.first_name = full_name.strip()
        user.save()

        profile = user.profile
        profile.full_name = full_name
        profile.role = 'student'

        if faculty_id:
            profile.faculty_id = faculty_id

        profile.save()
        return user


class GoogleLoginSerializer(serializers.Serializer):
    credential = serializers.CharField()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    login = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = 'superadmin' if user.is_superuser else getattr(user.profile, 'role', 'student')
        return token

    def validate(self, attrs):
        login_value = attrs.get('login', '').strip()

        if not login_value:
            raise serializers.ValidationError({
                'login': ['Введите email или username.']
            })

        matched_user = User.objects.filter(email__iexact=login_value).first()
        attrs[self.username_field] = matched_user.username if matched_user else login_value

        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class TaskSimpleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    title = serializers.CharField(max_length=200)
    status = serializers.CharField(max_length=20)


class SubjectSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=100)
    tasks_count = serializers.IntegerField()


class StudentSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=150)
    faculty_name = serializers.CharField(allow_null=True, required=False)
    boards_count = serializers.IntegerField()
    tasks_count = serializers.IntegerField()
    completed_tasks_count = serializers.IntegerField()
    overdue_tasks_count = serializers.IntegerField()


class SubjectModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = '__all__'


class BoardModelSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    tasks_count = serializers.SerializerMethodField()
    completed_tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = Board
        fields = [
            'id',
            'title',
            'description',
            'subject',
            'subject_name',
            'owner',
            'created_at',
            'tasks_count',
            'completed_tasks_count',
        ]
        read_only_fields = ['owner', 'created_at', 'tasks_count', 'completed_tasks_count', 'subject_name']

    def get_tasks_count(self, obj):
        return obj.tasks.filter(owner=obj.owner).count()

    def get_completed_tasks_count(self, obj):
        return obj.tasks.filter(owner=obj.owner, status='completed').count()


class SubtaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subtask
        fields = ['id', 'task', 'title', 'is_completed', 'order', 'completed_at']
        read_only_fields = ['task', 'completed_at']


class TaskActivitySerializer(serializers.ModelSerializer):
    subtask_title = serializers.CharField(source='subtask.title', read_only=True)

    class Meta:
        model = TaskActivity
        fields = ['id', 'event_type', 'message', 'created_at', 'subtask', 'subtask_title']


class TaskModelSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    board_title = serializers.CharField(source='board.title', read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    subtasks = SubtaskSerializer(many=True, read_only=True)
    activity_log = TaskActivitySerializer(many=True, read_only=True)
    progress_percentage = serializers.SerializerMethodField()
    completed_subtasks_count = serializers.SerializerMethodField()
    total_subtasks_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'due_date',
            'completed_at',
            'status',
            'priority',
            'subject',
            'subject_name',
            'board',
            'board_title',
            'owner',
            'owner_username',
            'subtasks',
            'progress_percentage',
            'completed_subtasks_count',
            'total_subtasks_count',
            'activity_log',
        ]
        read_only_fields = [
            'owner',
            'owner_username',
            'subject_name',
            'board_title',
            'subtasks',
            'progress_percentage',
            'completed_subtasks_count',
            'total_subtasks_count',
            'activity_log',
            'completed_at',
        ]

    def validate(self, attrs):
        subject = attrs.get('subject') or getattr(self.instance, 'subject', None)
        board = attrs.get('board') or getattr(self.instance, 'board', None)

        if board and subject and board.subject_id and board.subject_id != subject.id:
            raise serializers.ValidationError({
                'board': ['Board subject does not match selected subject.']
            })

        return attrs

    def get_total_subtasks_count(self, obj):
        return obj.subtasks.count()

    def get_completed_subtasks_count(self, obj):
        return obj.subtasks.filter(is_completed=True).count()

    def get_progress_percentage(self, obj):
        total = obj.subtasks.count()
        if total == 0:
            return 100 if obj.status == 'completed' else 0
        completed = obj.subtasks.filter(is_completed=True).count()
        return round((completed / total) * 100)


class StudySessionModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = '__all__'


class NoteModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = '__all__'
