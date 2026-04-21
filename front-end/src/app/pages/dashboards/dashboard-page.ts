import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Subject, Task } from '../../models/api.models';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);

  tasks = signal<Task[]>([]);
  subjects = signal<Subject[]>([]);
  isLoadingTasks = signal(true);
  isLoadingSubjects = signal(true);
  errorMessage = signal<string | null>(null);

  totalTasks = computed(() => this.tasks().length);
  completedTasks = computed(
    () => this.tasks().filter((task) => task.status === 'completed').length,
  );
  inProgressTasks = computed(
    () => this.tasks().filter((task) => task.status === 'in_progress').length,
  );
  overdueTasks = computed(
    () => this.tasks().filter((task) => task.status === 'overdue').length,
  );
  totalSubjects = computed(() => this.subjects().length);

  ngOnInit(): void {
    this.loadTasks();
    this.loadSubjects();
  }

  loadTasks(): void {
    this.isLoadingTasks.set(true);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        console.error('Dashboard tasks load error:', err);
        this.errorMessage.set(
          err?.error?.detail || 'Failed to load tasks for dashboard.',
        );
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
        console.error('Dashboard subjects load error:', err);
        this.errorMessage.set(
          err?.error?.detail || 'Failed to load subjects for dashboard.',
        );
        this.isLoadingSubjects.set(false);
      },
    });
  }
}
