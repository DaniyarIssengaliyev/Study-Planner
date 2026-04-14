import { Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Task } from '../../models/api.models';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.css',
})
export class TasksPage implements OnInit {
  private api = inject(ApiService);

  tasks: Task[] = [];

  ngOnInit(): void {
    this.api.getTasks().subscribe({
      next: (data) => {
        this.tasks = data;
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
      },
    });
  }
}
