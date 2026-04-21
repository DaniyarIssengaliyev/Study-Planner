import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject, Subtask, Task, TaskActivity } from '../../models/api.models';

type BoardStatus = 'todo' | 'in_progress' | 'completed';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private countdownTimerId: number | null = null;

  tasks = signal<Task[]>([]);
  subjects = signal<Subject[]>([]);
  isLoadingTasks = signal(true);
  isLoadingSubjects = signal(true);
  isSaving = signal(false);
  pageErrorMessage = signal<string | null>(null);
  taskErrorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  currentTime = signal(new Date());

  isCreateModalOpen = signal(false);
  isTaskModalOpen = signal(false);
  selectedTask = signal<Task | null>(null);
  draggedTaskId = signal<number | null>(null);
  dragOverColumn = signal<BoardStatus | null>(null);

  readonly columns: Array<{ key: BoardStatus; title: string }> = [
    { key: 'todo', title: 'To Do' },
    { key: 'in_progress', title: 'In Progress' },
    { key: 'completed', title: 'Completed' },
  ];

  createForm = this.getEmptyCreateForm();
  taskForm = this.getEmptyEditForm();
  newSubtaskTitle = '';
  createValidationTriggered = false;

  ngOnInit(): void {
    this.loadSubjects();
    this.loadTasks();
    this.countdownTimerId = window.setInterval(() => {
      this.currentTime.set(new Date());
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimerId !== null) {
      window.clearInterval(this.countdownTimerId);
    }
  }

  getEmptyCreateForm() {
    return {
      title: '',
      description: '',
      due_date: '',
      priority: 'medium' as 'low' | 'medium' | 'high',
      status: 'todo' as BoardStatus,
      subject: null as number | null,
    };
  }

  getEmptyEditForm() {
    return {
      id: 0,
      title: '',
      description: '',
      due_date: '',
      priority: 'medium' as 'low' | 'medium' | 'high',
      status: 'todo' as BoardStatus,
      subject: null as number | null,
    };
  }

  loadSubjects(): void {
    this.isLoadingSubjects.set(true);

    this.api.getSubjects().subscribe({
      next: (subjects) => {
        const sorted = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
        this.subjects.set(sorted);

        if (!this.createForm.subject && sorted.length > 0) {
          this.createForm.subject = sorted[0].id;
        }

        this.isLoadingSubjects.set(false);
      },
      error: (err) => {
        this.pageErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to load subjects.');
        this.isLoadingSubjects.set(false);
      },
    });
  }

  loadTasks(): void {
    this.isLoadingTasks.set(true);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.currentTime.set(new Date());
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        this.pageErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to load tasks.');
        this.isLoadingTasks.set(false);
      },
    });
  }

  tasksByStatus(status: BoardStatus): Task[] {
    return this.tasks().filter((task) => this.normalizeStatus(task.status) === status);
  }

  normalizeStatus(status: Task['status']): BoardStatus {
    if (status === 'overdue') {
      return 'todo';
    }
    return status;
  }

  openCreateModal(): void {
    this.createForm = this.getEmptyCreateForm();
    this.createForm.subject = this.subjects()[0]?.id ?? null;
    this.createValidationTriggered = false;
    this.isCreateModalOpen.set(true);
    this.successMessage.set(null);
  }

  closeCreateModal(): void {
    this.createValidationTriggered = false;
    this.isCreateModalOpen.set(false);
  }

  createTask(): void {
    this.successMessage.set(null);
    this.createValidationTriggered = true;

    if (!this.createForm.title.trim() || !this.createForm.due_date || !this.createForm.subject) {
      return;
    }

    this.isSaving.set(true);

    this.api
      .createTask({
        title: this.createForm.title.trim(),
        description: this.createForm.description.trim(),
        due_date: this.toApiDateTime(this.createForm.due_date),
        priority: this.createForm.priority,
        status: this.createForm.status,
        subject: Number(this.createForm.subject),
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((current) => [task, ...current]);
          this.isSaving.set(false);
          this.createValidationTriggered = false;
          this.isCreateModalOpen.set(false);
          this.successMessage.set('Task created.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.pageErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to create task.');
        },
      });
  }

  openTaskDetails(task: Task): void {
    this.taskErrorMessage.set(null);
    this.successMessage.set(null);
    this.isTaskModalOpen.set(true);

    this.api.getTaskById(task.id).subscribe({
      next: (fullTask) => {
        this.selectedTask.set(fullTask);
        this.taskForm = {
          id: fullTask.id,
          title: fullTask.title,
          description: fullTask.description,
          due_date: this.toDateTimeLocalValue(fullTask.due_date),
          priority: fullTask.priority,
          status: this.normalizeStatus(fullTask.status),
          subject: fullTask.subject,
        };
      },
      error: (err) => {
        this.taskErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to open task.');
      },
    });
  }

  closeTaskDetails(): void {
    this.isTaskModalOpen.set(false);
    this.selectedTask.set(null);
    this.newSubtaskTitle = '';
    this.taskErrorMessage.set(null);
  }

  saveTaskDetails(): void {
    const currentTask = this.selectedTask();
    if (!currentTask || !this.taskForm.subject) {
      return;
    }

    this.taskErrorMessage.set(null);
    this.isSaving.set(true);

    this.api
      .updateTask(currentTask.id, {
        title: this.taskForm.title.trim(),
        description: this.taskForm.description.trim(),
        due_date: this.toApiDateTime(this.taskForm.due_date),
        priority: this.taskForm.priority,
        status: this.taskForm.status,
        subject: Number(this.taskForm.subject),
      })
      .subscribe({
        next: (updatedTask) => {
          this.replaceTask(updatedTask);
          this.selectedTask.set(updatedTask);
          this.taskForm = {
            id: updatedTask.id,
            title: updatedTask.title,
            description: updatedTask.description,
            due_date: this.toDateTimeLocalValue(updatedTask.due_date),
            priority: updatedTask.priority,
            status: this.normalizeStatus(updatedTask.status),
            subject: updatedTask.subject,
          };
          this.isSaving.set(false);
          this.successMessage.set('Task updated.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.taskErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to update task.');
        },
      });
  }

  deleteTask(taskId: number): void {
    this.api.deleteTask(taskId).subscribe({
      next: () => {
        this.tasks.update((current) => current.filter((task) => task.id !== taskId));
        if (this.selectedTask()?.id === taskId) {
          this.closeTaskDetails();
        }
        this.successMessage.set('Task deleted.');
      },
      error: (err) => {
        this.taskErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to delete task.');
      },
    });
  }

  toggleTaskCompletion(task: Task, event?: Event): void {
    event?.stopPropagation();
    const nextStatus: BoardStatus = task.status === 'completed' ? 'todo' : 'completed';

    this.taskErrorMessage.set(null);

    this.api
      .updateTask(task.id, {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status: nextStatus,
        subject: task.subject,
      })
      .subscribe({
        next: (updatedTask) => {
          this.replaceTask(updatedTask);

          if (this.selectedTask()?.id === updatedTask.id) {
            this.selectedTask.set(updatedTask);
            this.taskForm.status = this.normalizeStatus(updatedTask.status);
          }

          this.successMessage.set(
            updatedTask.status === 'completed' ? 'Task completed.' : 'Task moved back to active.',
          );
        },
        error: (err) => {
          const message = this.extractErrorMessage(err?.error) || 'Failed to update task status.';
          if (this.selectedTask()?.id === task.id) {
            this.taskErrorMessage.set(message);
          } else {
            this.pageErrorMessage.set(message);
          }
        },
      });
  }

  onDragStart(taskId: number): void {
    this.draggedTaskId.set(taskId);
  }

  onDragEnd(): void {
    this.draggedTaskId.set(null);
    this.dragOverColumn.set(null);
  }

  allowDrop(event: DragEvent, column: BoardStatus): void {
    event.preventDefault();
    this.dragOverColumn.set(column);
  }

  leaveDropZone(column: BoardStatus): void {
    if (this.dragOverColumn() === column) {
      this.dragOverColumn.set(null);
    }
  }

  dropToColumn(status: BoardStatus): void {
    const taskId = this.draggedTaskId();
    if (!taskId) {
      return;
    }

    const task = this.tasks().find((item) => item.id === taskId);
    if (!task || this.normalizeStatus(task.status) === status) {
      this.draggedTaskId.set(null);
      this.dragOverColumn.set(null);
      return;
    }

    this.api
      .updateTask(task.id, {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status,
        subject: task.subject,
      })
      .subscribe({
        next: (updatedTask) => {
          this.replaceTask(updatedTask);

          if (this.selectedTask()?.id === updatedTask.id) {
            this.selectedTask.set(updatedTask);
            this.taskForm.status = this.normalizeStatus(updatedTask.status);
          }

          this.successMessage.set(null);
          this.draggedTaskId.set(null);
          this.dragOverColumn.set(null);
        },
        error: (err) => {
          this.pageErrorMessage.set(this.extractErrorMessage(err?.error) || null);
          this.draggedTaskId.set(null);
          this.dragOverColumn.set(null);
        },
      });
  }

  addSubtask(): void {
    const task = this.selectedTask();
    const title = this.newSubtaskTitle.trim();

    if (!task || !title) {
      return;
    }

    this.api.createSubtask(task.id, { title }).subscribe({
      next: (subtask) => {
        const updatedTask = this.syncTaskProgress({
          ...task,
          subtasks: [...(task.subtasks ?? []), subtask],
        });
        this.selectedTask.set(updatedTask);
        this.replaceTask(updatedTask);
        this.newSubtaskTitle = '';
      },
      error: (err) => {
        this.taskErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to create subtask.');
      },
    });
  }

  toggleSubtask(subtask: Subtask, completed: boolean): void {
    this.api
      .updateSubtask(subtask.id, {
        title: subtask.title,
        is_completed: completed,
        order: subtask.order,
      })
      .subscribe({
        next: (updatedSubtask) => {
          this.patchSelectedSubtask(updatedSubtask);
        },
        error: (err) => {
          this.taskErrorMessage.set(
            this.extractErrorMessage(err?.error) || 'Failed to update subtask.',
          );
        },
      });
  }

  deleteSubtask(subtaskId: number): void {
    this.api.deleteSubtask(subtaskId).subscribe({
      next: () => {
        const task = this.selectedTask();
        if (!task) {
          return;
        }

        const updatedTask = {
          ...task,
          subtasks: (task.subtasks ?? []).filter((item) => item.id !== subtaskId),
        };

        const syncedTask = this.syncTaskProgress(updatedTask);
        this.selectedTask.set(syncedTask);
        this.replaceTask(syncedTask);
      },
      error: (err) => {
        this.taskErrorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to delete subtask.');
      },
    });
  }

  isTaskCompleted(task: Task | null): boolean {
    return task?.status === 'completed';
  }

  completedSubtasks(task: Task | null): number {
    return task?.completed_subtasks_count ?? (task?.subtasks ?? []).filter((item) => item.is_completed).length;
  }

  subtaskCount(task: Task | null): number {
    return task?.total_subtasks_count ?? task?.subtasks?.length ?? 0;
  }

  progressPercentage(task: Task | null): number {
    if (!task) {
      return 0;
    }

    if (typeof task.progress_percentage === 'number') {
      return task.progress_percentage;
    }

    const total = this.subtaskCount(task);
    if (total === 0) {
      return 0;
    }

    return Math.round((this.completedSubtasks(task) / total) * 100);
  }

  formatDueDate(dueDate: string): string {
    const parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) {
      return dueDate;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }

  deadlineCountdown(task: Task | null): string {
    if (!task?.due_date) {
      return 'No deadline';
    }

    const dueDate = new Date(task.due_date);
    if (Number.isNaN(dueDate.getTime())) {
      return 'Invalid deadline';
    }

    const diffMs = dueDate.getTime() - this.currentTime().getTime();
    const absMinutes = Math.floor(Math.abs(diffMs) / 60000);
    const days = Math.floor(absMinutes / (60 * 24));
    const hours = Math.floor((absMinutes % (60 * 24)) / 60);
    const minutes = absMinutes % 60;
    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }

    if (hours > 0 || days > 0) {
      parts.push(`${hours}h`);
    }

    parts.push(`${minutes}m`);

    const formatted = parts.join(' ');
    return diffMs >= 0 ? `${formatted} left` : `${formatted} overdue`;
  }

  historyEntries(task: Task | null): TaskActivity[] {
    return task?.activity_log ?? [];
  }

  formatHistoryDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }

  priorityLabel(priority: Task['priority']): string {
    if (priority === 'high') {
      return 'High';
    }

    if (priority === 'low') {
      return 'Low';
    }

    return 'Medium';
  }

  showCreateFieldError(field: 'title' | 'due_date' | 'subject'): boolean {
    if (!this.createValidationTriggered) {
      return false;
    }

    if (field === 'title') {
      return !this.createForm.title.trim();
    }

    if (field === 'due_date') {
      return !this.createForm.due_date;
    }

    return !this.createForm.subject;
  }

  private replaceTask(task: Task): void {
    this.tasks.update((current) => current.map((item) => (item.id === task.id ? task : item)));
  }

  private patchSelectedSubtask(subtask: Subtask): void {
    const task = this.selectedTask();
    if (!task) {
      return;
    }

    const updatedTask = this.syncTaskProgress({
      ...task,
      subtasks: (task.subtasks ?? []).map((item) => (item.id === subtask.id ? subtask : item)),
    });

    this.selectedTask.set(updatedTask);
    this.replaceTask(updatedTask);
  }

  completionButtonLabel(task: Task | null): string {
    return this.isTaskCompleted(task) ? 'Mark as active' : 'Mark as completed';
  }

  private syncTaskProgress(task: Task): Task {
    const subtasks = task.subtasks ?? [];
    const total = subtasks.length;
    const completed = subtasks.filter((item) => item.is_completed).length;

    return {
      ...task,
      total_subtasks_count: total,
      completed_subtasks_count: completed,
      progress_percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }

  private toDateTimeLocalValue(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private toApiDateTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const detail = (error as { detail?: unknown }).detail;
      if (typeof detail === 'string') {
        return detail;
      }

      const values = Object.values(error as Record<string, unknown>);
      for (const value of values) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
          return value[0];
        }

        if (typeof value === 'string') {
          return value;
        }
      }
    }

    return null;
  }
}
