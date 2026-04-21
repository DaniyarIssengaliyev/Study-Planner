import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Subject } from '../../models/api.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subjects-page',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './subjects-page.html',
  styleUrl: './subjects-page.css',
})
export class SubjectsPage implements OnInit {
  private api = inject(ApiService);

  subjects = signal<Subject[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.isLoading.set(true);
    this.api.getSubjects().subscribe({
      next: (data) => {
        this.subjects.set(data);
        this.errorMessage.set(null);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Не удалось загрузить предметы.');
        this.isLoading.set(false);
      },
    });
  }
}
