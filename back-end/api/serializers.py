from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Faculty, Profile, Subject, Task, StudySession, Note


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ['id', 'name']


class ProfileSerializer(serializers.ModelSerializer):
    faculty = FacultySerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ['full_name', 'role', 'faculty']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, write_only=True, default='student')
    faculty_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'full_name', 'role', 'faculty_id']

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists.')
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already exists.')
        return value

    def create(self, validated_data):
        full_name = validated_data.pop('full_name')
        role = validated_data.pop('role', 'student')
        faculty_id = validated_data.pop('faculty_id', None)

        user = User.objects.create_user(**validated_data)

        first_name = full_name.strip()
        user.first_name = first_name
        user.save()

        profile = user.profile
        profile.full_name = full_name
        profile.role = role

        if faculty_id:
            profile.faculty_id = faculty_id

        profile.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = getattr(user.profile, 'role', 'student')
        return token

    def validate(self, attrs):
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
