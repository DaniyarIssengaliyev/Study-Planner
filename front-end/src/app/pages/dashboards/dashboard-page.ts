import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Board, FacultyOverview, Subject, Task } from '../../models/api.models';

type TaskStatusKey = 'todo' | 'in_progress' | 'completed' | 'overdue';
type BoardSort = 'title' | 'tasks_desc' | 'progress_desc' | 'created_desc';
type FacultySort = 'name' | 'students_desc' | 'subjects_desc' | 'tasks_desc' | 'completion_desc';

interface ChartSlice {
  key: TaskStatusKey;
  label: string;
  value: number;
  color: string;
}

interface SubjectLoadItem {
  name: string;
  value: number;
}

interface DailyBucket {
  label: string;
  shortLabel: string;
  value: number;
}

interface FacultyChartSlice {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthService);

  tasks = signal<Task[]>([]);
  subjects = signal<Subject[]>([]);
  boards = signal<Board[]>([]);
  faculties = signal<FacultyOverview[]>([]);

  isLoadingTasks = signal(true);
  isLoadingSubjects = signal(true);
  isLoadingBoards = signal(true);
  isLoadingFaculties = signal(true);
  errorMessage = signal<string | null>(null);

  selectedBoardId = signal<number | null>(null);
  boardSort = signal<BoardSort>('tasks_desc');

  selectedFacultyId = signal<number | null>(null);
  facultySort = signal<FacultySort>('tasks_desc');

  isSuperadmin = computed(() => this.auth.isSuperadmin());

  selectedBoard = computed(() => {
    const boardId = this.selectedBoardId();
    return this.boards().find((board) => board.id === boardId) ?? null;
  });

  visibleBoards = computed(() => {
    const items = [...this.boards()];

    switch (this.boardSort()) {
      case 'title':
        return items.sort((a, b) => a.title.localeCompare(b.title));
      case 'progress_desc':
        return items.sort((a, b) => this.boardProgress(b) - this.boardProgress(a));
      case 'created_desc':
        return items.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      default:
        return items.sort((a, b) => (b.tasks_count ?? 0) - (a.tasks_count ?? 0));
    }
  });

  filteredTasks = computed(() => {
    const boardId = this.selectedBoardId();
    if (!boardId) {
      return [];
    }
    return this.tasks().filter((task) => task.board === boardId);
  });

  totalTasks = computed(() => this.filteredTasks().length);
  completedTasks = computed(
    () =>
      this.filteredTasks().filter((task) => task.status === 'completed' && !this.isTaskLate(task))
        .length,
  );
  inProgressTasks = computed(
    () =>
      this.filteredTasks().filter((task) => task.status === 'in_progress' && !this.isTaskLate(task))
        .length,
  );
  overdueTasks = computed(() => this.filteredTasks().filter((task) => this.isTaskLate(task)).length);
  totalSubjects = computed(() => {
    const ids = new Set(this.filteredTasks().map((task) => task.subject));
    return ids.size;
  });

  averageProgress = computed(() => {
    const tasks = this.filteredTasks();
    if (tasks.length === 0) {
      return 0;
    }

    const total = tasks.reduce((sum, task) => sum + this.progressPercentage(task), 0);
    return Math.round(total / tasks.length);
  });

  completionRate = computed(() => {
    const total = this.totalTasks();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.completedTasks() / total) * 100);
  });

  statusBreakdown = computed<ChartSlice[]>(() => [
    {
      key: 'todo',
      label: 'To Do',
      value: this.filteredTasks().filter((task) => task.status === 'todo' && !this.isTaskLate(task))
        .length,
      color: '#f59e0b',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      value: this.inProgressTasks(),
      color: '#3b82f6',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: this.completedTasks(),
      color: '#10b981',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: this.overdueTasks(),
      color: '#ef4444',
    },
  ]);

  statusChartStyle = computed(() => {
    const total = this.totalTasks();
    if (total === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let currentAngle = 0;
    const segments = this.statusBreakdown().map((slice) => {
      const angle = (slice.value / total) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;
      currentAngle = end;
      return `${slice.color} ${start}deg ${end}deg`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  });

  subjectLoad = computed<SubjectLoadItem[]>(() => {
    const subjectsById = new Map(this.subjects().map((subject) => [subject.id, subject.name]));
    const counts = new Map<string, number>();

    for (const task of this.filteredTasks()) {
      const subjectName =
        task.subject_name?.trim() || subjectsById.get(task.subject) || `Subject #${task.subject}`;
      counts.set(subjectName, (counts.get(subjectName) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, 6);
  });

  deadlineBuckets = computed<DailyBucket[]>(() => {
    const startOfToday = this.startOfDay(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() + index);

      const value = this.filteredTasks().filter((task) => {
        if (task.status === 'completed') {
          return false;
        }

        const dueDate = new Date(task.due_date);
        return !Number.isNaN(dueDate.getTime()) && this.isSameDay(dueDate, date);
      }).length;

      return {
        label: new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }).format(date),
        shortLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
        value,
      };
    });
  });

  selectedFaculty = computed(() => {
    const facultyId = this.selectedFacultyId();
    return this.faculties().find((faculty) => faculty.id === facultyId) ?? null;
  });

  facultyStatusBreakdown = computed<FacultyChartSlice[]>(() => {
    const faculty = this.selectedFaculty();
    if (!faculty) {
      return [];
    }

    return [
      {
        label: 'To Do',
        value: faculty.analytics.todo_tasks,
        color: '#f59e0b',
      },
      {
        label: 'In Progress',
        value: faculty.analytics.in_progress_tasks,
        color: '#3b82f6',
      },
      {
        label: 'Completed',
        value: faculty.analytics.completed_tasks,
        color: '#10b981',
      },
      {
        label: 'Overdue',
        value: faculty.analytics.overdue_tasks,
        color: '#ef4444',
      },
    ];
  });

  facultyStatusChartStyle = computed(() => {
    const faculty = this.selectedFaculty();
    if (!faculty || faculty.analytics.total_tasks === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let currentAngle = 0;
    const segments = this.facultyStatusBreakdown().map((slice) => {
      const angle = (slice.value / faculty.analytics.total_tasks) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;
      currentAngle = end;
      return `${slice.color} ${start}deg ${end}deg`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  });

  visibleFaculties = computed(() => {
    const items = [...this.faculties()];

    switch (this.facultySort()) {
      case 'name':
        return items.sort((a, b) => a.name.localeCompare(b.name));
      case 'students_desc':
        return items.sort((a, b) => b.students.length - a.students.length || a.name.localeCompare(b.name));
      case 'subjects_desc':
        return items.sort((a, b) => b.subjects.length - a.subjects.length || a.name.localeCompare(b.name));
      case 'completion_desc':
        return items.sort(
          (a, b) => this.facultyCompletionRate(b) - this.facultyCompletionRate(a) || a.name.localeCompare(b.name),
        );
      default:
        return items.sort(
          (a, b) => this.facultyTasksCount(b) - this.facultyTasksCount(a) || a.name.localeCompare(b.name),
        );
    }
  });

  ngOnInit(): void {
    if (this.isSuperadmin()) {
      this.loadFacultyOverview();
      return;
    }

    this.loadTasks();
    this.loadSubjects();
    this.loadBoards();
  }

  loadTasks(): void {
    this.isLoadingTasks.set(true);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load tasks for dashboard.');
        this.isLoadingTasks.set(false);
      },
    });
  }

  loadSubjects(): void {
    this.isLoadingSubjects.set(true);

    this.api.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.isLoadingSubjects.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load subjects for dashboard.');
        this.isLoadingSubjects.set(false);
      },
    });
  }

  loadBoards(): void {
    this.isLoadingBoards.set(true);

    this.api.getBoards().subscribe({
      next: (boards) => {
        this.boards.set(boards);
        this.isLoadingBoards.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load boards for dashboard.');
        this.isLoadingBoards.set(false);
      },
    });
  }

  loadFacultyOverview(): void {
    this.isLoadingFaculties.set(true);

    this.api.getFacultyOverview().subscribe({
      next: (faculties) => {
        const sorted = [...faculties].sort((a, b) => a.name.localeCompare(b.name));
        this.faculties.set(sorted);
        this.selectedFacultyId.set(sorted[0]?.id ?? null);
        this.isLoadingFaculties.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load faculty statistics.');
        this.isLoadingFaculties.set(false);
      },
    });
  }

  selectBoard(boardId: number): void {
    this.selectedBoardId.set(boardId);
  }

  clearBoardSelection(): void {
    this.selectedBoardId.set(null);
  }

  selectFaculty(facultyId: number): void {
    this.selectedFacultyId.set(facultyId);
  }

  clearFacultySelection(): void {
    this.selectedFacultyId.set(null);
  }

  chartBarHeight(value: number, max: number): string {
    if (max <= 0) {
      return '10%';
    }

    return `${Math.max(10, Math.round((value / max) * 100))}%`;
  }

  chartBarWidth(value: number, max: number): string {
    if (max <= 0) {
      return '0%';
    }

    return `${Math.round((value / max) * 100)}%`;
  }

  maxDeadlineValue(): number {
    return Math.max(...this.deadlineBuckets().map((bucket) => bucket.value), 0);
  }

  maxSubjectLoadValue(): number {
    return Math.max(...this.subjectLoad().map((item) => item.value), 0);
  }

  boardProgress(board: Board): number {
    const boardTasks = this.tasks().filter((task) => task.board === board.id);
    if (boardTasks.length === 0) {
      return 0;
    }

    const total = boardTasks.reduce((sum, task) => sum + this.progressPercentage(task), 0);
    return Math.round(total / boardTasks.length);
  }

  progressPercentage(task: Task): number {
    if (typeof task.progress_percentage === 'number') {
      return task.progress_percentage;
    }

    const total = task.total_subtasks_count ?? task.subtasks?.length ?? 0;
    if (total === 0) {
      return task.status === 'completed' ? 100 : 0;
    }

    const completed =
      task.completed_subtasks_count ??
      task.subtasks?.filter((item) => item.is_completed).length ??
      0;
    return Math.round((completed / total) * 100);
  }

  isTaskLate(task: Task): boolean {
    const dueDate = new Date(task.due_date);
    if (Number.isNaN(dueDate.getTime())) {
      return false;
    }

    if (task.completed_at) {
      const completedAt = new Date(task.completed_at);
      return !Number.isNaN(completedAt.getTime()) && completedAt.getTime() > dueDate.getTime();
    }

    return Date.now() > dueDate.getTime();
  }

  facultyStudentsCount(faculty: FacultyOverview | null): number {
    return faculty?.students.length ?? 0;
  }

  facultySubjectsCount(faculty: FacultyOverview | null): number {
    return faculty?.subjects.length ?? 0;
  }

  facultyBoardsCount(faculty: FacultyOverview | null): number {
    if (!faculty) {
      return 0;
    }

    return faculty.students.reduce((sum, student) => sum + (student.boards_count ?? 0), 0);
  }

  facultyTasksCount(faculty: FacultyOverview | null): number {
    if (!faculty) {
      return 0;
    }

    return faculty.students.reduce((sum, student) => sum + (student.tasks_count ?? 0), 0);
  }

  facultyCompletedCount(faculty: FacultyOverview | null): number {
    if (!faculty) {
      return 0;
    }

    return faculty.students.reduce((sum, student) => sum + (student.completed_tasks_count ?? 0), 0);
  }

  facultyOverdueCount(faculty: FacultyOverview | null): number {
    if (!faculty) {
      return 0;
    }

    return faculty.students.reduce((sum, student) => sum + (student.overdue_tasks_count ?? 0), 0);
  }

  facultyCompletionRate(faculty: FacultyOverview | null): number {
    const total = this.facultyTasksCount(faculty);
    if (total === 0) {
      return 0;
    }

    return Math.round((this.facultyCompletedCount(faculty) / total) * 100);
  }

  facultyMaxDeadlineValue(faculty: FacultyOverview | null): number {
    return Math.max(...(faculty?.analytics.deadline_buckets.map((bucket) => bucket.value) ?? [0]), 0);
  }

  facultyMaxSubjectLoadValue(faculty: FacultyOverview | null): number {
    return Math.max(...(faculty?.analytics.subject_load.map((item) => item.value) ?? [0]), 0);
  }

  formatFacultyBucketLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  }

  private startOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }
}
