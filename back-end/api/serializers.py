from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Board, Faculty, Profile, Subject, Subtask, Task, TaskActivity


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


class ProfileSettingsSerializer(serializers.Serializer):
    email = serializers.EmailField()
    faculty_id = serializers.IntegerField(required=False, allow_null=True)
    current_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    new_password = serializers.CharField(required=False, allow_blank=True, min_length=6, write_only=True)

    def validate_email(self, value):
        user = self.context['request'].user
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('User with this email already exists.')
        return value

    def validate_faculty_id(self, value):
        if value is None:
            return value
 
        if not Faculty.objects.filter(pk=value).exists():
            raise serializers.ValidationError('Faculty not found.')
        return value

    def validate(self, attrs):
        current_password = attrs.get('current_password', '')
        new_password = attrs.get('new_password', '')

        if current_password and not new_password:
            raise serializers.ValidationError({
                'new_password': ['Enter a new password.']
            })

        if new_password and not current_password:
            raise serializers.ValidationError({
                'current_password': ['Enter your current password.']
            })

        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        profile = user.profile

        user.email = self.validated_data['email']

        new_password = self.validated_data.get('new_password', '')
        current_password = self.validated_data.get('current_password', '')
        if new_password:
            if not user.check_password(current_password):
                raise serializers.ValidationError({
                    'current_password': ['Current password is incorrect.']
                })
            user.set_password(new_password)

        user.save()

        if 'faculty_id' in self.validated_data:
            profile.faculty_id = self.validated_data['faculty_id']
            profile.save(update_fields=['faculty'])

        return user


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
                'login': ['Enter email or username.']
            })

        matched_user = User.objects.filter(email__iexact=login_value).first()
        attrs[self.username_field] = matched_user.username if matched_user else login_value

        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class StudentSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(max_length=150)
    full_name = serializers.CharField(max_length=150)
    faculty_id = serializers.IntegerField(allow_null=True, required=False)
    faculty_name = serializers.CharField(allow_null=True, required=False)
    boards_count = serializers.IntegerField(allow_null=True, required=False)
    tasks_count = serializers.IntegerField(allow_null=True, required=False)
    completed_tasks_count = serializers.IntegerField(allow_null=True, required=False)
    overdue_tasks_count = serializers.IntegerField(allow_null=True, required=False)


class SubjectModelSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'description', 'color', 'faculty', 'faculty_name']

    def validate(self, attrs):
        faculty = attrs.get('faculty') or getattr(self.instance, 'faculty', None)

        if not faculty:
            raise serializers.ValidationError({
                'faculty': ['Select a faculty for this subject.']
            })

        return attrs

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

