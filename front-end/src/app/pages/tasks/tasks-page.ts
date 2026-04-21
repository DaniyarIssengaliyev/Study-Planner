import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject, Task } from '../../models/api.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit {
  private api = inject(ApiService);

  tasks = signal<Task[]>([]);
  subjects = signal<Subject[]>([]);
  isLoadingTasks = signal(true);
  isLoadingSubjects = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  newTask = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'todo',
    subject: null as number | null,
  };

  ngOnInit(): void {
    this.loadSubjects();
    this.loadTasks();
  }

  loadSubjects(): void {
    this.isLoadingSubjects.set(true);

    this.api.getSubjects().subscribe({
      next: (subjects) => {
        const sortedSubjects = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
        this.subjects.set(sortedSubjects);

        if (!this.newTask.subject && sortedSubjects.length > 0) {
          this.newTask.subject = sortedSubjects[0].id;
        }

        this.errorMessage.set(null);
        this.isLoadingSubjects.set(false);
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.errorMessage.set(
          this.extractErrorMessage(err?.error) || 'Не удалось загрузить список предметов.',
        );
        this.isLoadingSubjects.set(false);
      },
    });
  }

  loadTasks(): void {
    this.isLoadingTasks.set(true);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.errorMessage.set(null);
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.errorMessage.set(
          this.extractErrorMessage(err?.error) || 'Не удалось загрузить задачи.',
        );
        this.isLoadingTasks.set(false);
      },
    });
  }

  createTask(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const subjectId = this.newTask.subject ? Number(this.newTask.subject) : null;

    if (!this.newTask.title.trim() || !this.newTask.dueDate || !subjectId) {
      this.errorMessage.set('Заполните название, дедлайн и предмет.');
      return;
    }

    this.api
      .createTask({
        title: this.newTask.title.trim(),
        description: this.newTask.description.trim(),
        due_date: this.newTask.dueDate,
        priority: this.newTask.priority as 'low' | 'medium' | 'high',
        status: this.newTask.status as 'todo' | 'in_progress' | 'completed',
        subject: subjectId,
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((current) => current.concat(task));
          this.successMessage.set('Задача создана.');
          this.errorMessage.set(null);

          this.newTask = {
            title: '',
            description: '',
            dueDate: '',
            priority: 'medium',
            status: 'todo',
            subject: this.subjects()[0]?.id ?? null,
          };
        },
        error: (err) => {
          console.error('Error creating task:', err);
          this.errorMessage.set(
            this.extractErrorMessage(err?.error) || 'Не удалось создать задачу.',
          );
          this.successMessage.set(null);
        },
      });
  }

  updateTask(task: Task, event: Event): void {
    event.stopPropagation();

    this.api
      .updateTask(task.id, {
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status: 'completed',
        subject: task.subject,
      })
      .subscribe({
        next: (updatedTask) => {
          this.tasks.update((current) =>
            current.map((item) => (item.id === updatedTask.id ? updatedTask : item)),
          );
          this.errorMessage.set(null);
          this.successMessage.set('Задача отмечена как выполненная.');
        },
        error: (err) => {
          console.error('Error updating task:', err);
          this.errorMessage.set(
            this.extractErrorMessage(err?.error) || 'Не удалось обновить задачу.',
          );
          this.successMessage.set(null);
        },
      });
  }

  deleteTask(id: number, event: Event): void {
    event.stopPropagation();

    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update((current) => current.filter((task) => task.id !== id));
        this.errorMessage.set(null);
        this.successMessage.set('Задача удалена.');
      },
      error: (err) => {
        console.error('Error deleting task:', err);
        this.errorMessage.set(
          this.extractErrorMessage(err?.error) || 'Не удалось удалить задачу.',
        );
        this.successMessage.set(null);
      },
    });
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
