import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
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
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  newTask = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'todo',
    subject: null as number | null,
  };

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    forkJoin({
      tasks: this.api.getTasks(),
      subjects: this.api.getSubjects(),
    }).subscribe({
      next: ({ tasks, subjects }) => {
        this.tasks.set(tasks);
        this.subjects.set(subjects);
        if (!this.newTask.subject && subjects.length > 0) {
          this.newTask.subject = subjects[0].id;
        }
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading tasks or subjects:', err);
        this.errorMessage.set('Failed to load tasks and subjects');
        this.isLoading.set(false);
      },
    });
  }

  createTask(): void {
    if (!this.newTask.title.trim() || !this.newTask.dueDate || !this.newTask.subject) {
      this.errorMessage.set('Fill in title, due date and subject before creating a task');
      return;
    }

    this.api
      .createTask({
        title: this.newTask.title.trim(),
        description: this.newTask.description.trim(),
        due_date: this.newTask.dueDate,
        priority: this.newTask.priority as 'low' | 'medium' | 'high',
        status: this.newTask.status as 'todo' | 'in_progress' | 'completed',
        subject: this.newTask.subject,
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((current) => current.concat(task));
          this.errorMessage.set('');

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
          this.errorMessage.set('Failed to create task');
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
          this.errorMessage.set('');
        },
        error: (err) => {
          console.error('Error updating task:', err);
          this.errorMessage.set('Failed to update task');
        },
      });
  }

  deleteTask(id: number, event: Event): void {
    event.stopPropagation();
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update((current) => current.filter((task) => task.id !== id));
        this.errorMessage.set('');
      },
      error: (err) => {
        console.error('Error deleting task:', err);
        this.errorMessage.set('Failed to delete task');
      },
    });
  }
}
