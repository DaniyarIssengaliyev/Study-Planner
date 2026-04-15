import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Task, Subject } from '../../models/api.models';
import { CommonModule } from '@angular/common';

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
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  totalTasks = computed(() => this.tasks().length);
  completedTasks = computed(
    () => this.tasks().filter((task) => task.status === 'completed').length,
  );
  inProgressTasks = computed(
    () => this.tasks().filter((task) => task.status === 'in_progress').length,
  );
  totalSubjects = computed(() => this.subjects().length);

  ngOnInit(): void {
    forkJoin({
      tasks: this.api.getTasks(),
      subjects: this.api.getSubjects(),
    }).subscribe({
      next: ({ tasks, subjects }) => {
        this.tasks.set(tasks);
        this.subjects.set(subjects);

        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.errorMessage.set('Failed to load dashboard data');
        this.isLoading.set(false);
      },
    });
  }
}
