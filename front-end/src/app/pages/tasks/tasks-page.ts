import { Component, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Task } from '../../models/api.models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
  imports: [FormsModule],
})
export class TasksPage {
  private api = inject(ApiService);

  tasks: Task[] = [];
  errorMessage = '';

  newTask = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    status: 'pending',
    subject: 1,
  };

  loadTasks(): void {
    this.api.getTasks().subscribe({
      next: (data) => {
        this.tasks = data;
        this.errorMessage = '';
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.errorMessage = 'Failed to load tasks';
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
        status: this.newTask.status as 'pending' | 'in_progress' | 'completed',
        subject: Number(this.newTask.subject),
      })
      .subscribe({
        next: (task) => {
          this.tasks.push(task);
          this.errorMessage = '';

          this.newTask = {
            title: '',
            description: '',
            dueDate: '',
            priority: 'medium',
            status: 'pending',
            subject: 1,
          };
        },
        error: (err) => {
          console.error('Error creating task:', err);
          this.errorMessage = 'Failed to create task';
        },
      });
  }

  updateTask(task: Task): void {
    this.api
      .updateTask(task.id, {
        status: 'completed',
      })
      .subscribe({
        next: (updatedTask) => {
          this.tasks = this.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item));
          this.errorMessage = '';
        },
        error: (err) => {
          console.error('Error updating task:', err);
          this.errorMessage = 'Failed to update task';
        },
      });
  }

  deleteTask(id: number): void {
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((task) => task.id !== id);
        this.errorMessage = '';
      },
      error: (err) => {
        console.error('Error deleting task:', err);
        this.errorMessage = 'Failed to delete task';
      },
    });
  }
}
