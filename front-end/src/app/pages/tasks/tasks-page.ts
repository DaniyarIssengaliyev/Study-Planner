import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject, Subtask, Task } from '../../models/api.models';

type BoardStatus = 'todo' | 'in_progress' | 'completed';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit {
  private api = inject(ApiService);

  tasks = signal<Task[]>([]);
  subjects = signal<Subject[]>([]);
  isLoadingTasks = signal(true);
  isLoadingSubjects = signal(true);
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

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

  ngOnInit(): void {
    this.loadSubjects();
    this.loadTasks();
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
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to load subjects.');
        this.isLoadingSubjects.set(false);
      },
    });
  }

  loadTasks(): void {
    this.isLoadingTasks.set(true);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to load tasks.');
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
    this.isCreateModalOpen.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  createTask(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.createForm.title.trim() || !this.createForm.due_date || !this.createForm.subject) {
      this.errorMessage.set('Fill title, date and subject.');
      return;
    }

    this.isSaving.set(true);

    this.api
      .createTask({
        title: this.createForm.title.trim(),
        description: this.createForm.description.trim(),
        due_date: this.createForm.due_date,
        priority: this.createForm.priority,
        status: this.createForm.status,
        subject: Number(this.createForm.subject),
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((current) => [task, ...current]);
          this.isSaving.set(false);
          this.isCreateModalOpen.set(false);
          this.successMessage.set('Task created.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to create task.');
        },
      });
  }

  openTaskDetails(task: Task): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isTaskModalOpen.set(true);

    this.api.getTaskById(task.id).subscribe({
      next: (fullTask) => {
        this.selectedTask.set(fullTask);
        this.taskForm = {
          id: fullTask.id,
          title: fullTask.title,
          description: fullTask.description,
          due_date: fullTask.due_date,
          priority: fullTask.priority,
          status: this.normalizeStatus(fullTask.status),
          subject: fullTask.subject,
        };
      },
      error: (err) => {
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to open task.');
      },
    });
  }

  closeTaskDetails(): void {
    this.isTaskModalOpen.set(false);
    this.selectedTask.set(null);
    this.newSubtaskTitle = '';
  }

  saveTaskDetails(): void {
    const currentTask = this.selectedTask();
    if (!currentTask || !this.taskForm.subject) {
      return;
    }

    this.isSaving.set(true);

    this.api
      .updateTask(currentTask.id, {
        title: this.taskForm.title.trim(),
        description: this.taskForm.description.trim(),
        due_date: this.taskForm.due_date,
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
            due_date: updatedTask.due_date,
            priority: updatedTask.priority,
            status: this.normalizeStatus(updatedTask.status),
            subject: updatedTask.subject,
          };
          this.isSaving.set(false);
          this.successMessage.set('Task updated.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to update task.');
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
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to delete task.');
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
          this.errorMessage.set(this.extractErrorMessage(err?.error) || null);
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
        const updatedTask = {
          ...task,
          subtasks: [...(task.subtasks ?? []), subtask],
        };
        this.selectedTask.set(updatedTask);
        this.replaceTask(updatedTask);
        this.newSubtaskTitle = '';
      },
      error: (err) => {
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to create subtask.');
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
          this.errorMessage.set(
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

        this.selectedTask.set(updatedTask);
        this.replaceTask(updatedTask);
      },
      error: (err) => {
        this.errorMessage.set(this.extractErrorMessage(err?.error) || 'Failed to delete subtask.');
      },
    });
  }

  completedSubtasks(task: Task | null): number {
    return (task?.subtasks ?? []).filter((item) => item.is_completed).length;
  }

  subtaskCount(task: Task | null): number {
    return task?.subtasks?.length ?? 0;
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

  private replaceTask(task: Task): void {
    this.tasks.update((current) => current.map((item) => (item.id === task.id ? task : item)));
  }

  private patchSelectedSubtask(subtask: Subtask): void {
    const task = this.selectedTask();
    if (!task) {
      return;
    }

    const updatedTask = {
      ...task,
      subtasks: (task.subtasks ?? []).map((item) => (item.id === subtask.id ? subtask : item)),
    };

    this.selectedTask.set(updatedTask);
    this.replaceTask(updatedTask);
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
