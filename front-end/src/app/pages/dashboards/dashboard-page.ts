import { Component, OnInit, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Task, Subject } from '../../models/api.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);

  tasks: Task[] = [];
  subjects: Subject[] = [];
  errorMessage = '';

  totalTasks = 0;
  completedTasks = 0;
  inProgressTasks = 0;
  totalSubjects = 0;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    forkJoin({
      tasks: this.api.getTasks(),
      subjects: this.api.getSubjects(),
    }).subscribe({
      next: ({ tasks, subjects }) => {
        this.tasks = tasks;
        this.subjects = subjects;

        this.totalTasks = tasks.length;
        this.completedTasks = tasks.filter((task) => task.status === 'completed').length;
        this.inProgressTasks = tasks.filter((task) => task.status === 'in_progress').length;
        this.totalSubjects = subjects.length;

        this.errorMessage = '';
      },
      error: (err) => {
        console.error('Dashboard load error:', err);
        this.errorMessage = 'Failed to load dashboard data';
      },
    });
  }
}
