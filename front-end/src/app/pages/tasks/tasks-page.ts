import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Task } from '../../models/api.models';
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
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  newTask = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'in_progress',
    subject: 1,
  };

  ngOnInit(): void {
    this.api.getTasks().subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.errorMessage.set('Failed to load tasks');
        this.isLoading.set(false);
      },
    });
  }

  createTask(): void {
    this.api
      .createTask({
        title: this.newTask.title,
        description: this.newTask.description,
        due_date: this.newTask.dueDate,
        priority: this.newTask.priority as 'low' | 'medium' | 'high',
        status: this.newTask.status as 'in_progress' | 'completed',
        subject: Number(this.newTask.subject),
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
            status: 'in_progress',
            subject: 1,
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
          this.errorMessage.set('Failed to create task');
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
