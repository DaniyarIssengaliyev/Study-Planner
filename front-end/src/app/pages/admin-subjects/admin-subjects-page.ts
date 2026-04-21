import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject } from '../../models/api.models';

@Component({
  selector: 'app-admin-subjects-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-subjects-page.html',
  styleUrl: './admin-subjects-page.css',
})
export class AdminSubjectsPage implements OnInit {
  private api = inject(ApiService);

  subjects = signal<Subject[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  newSubject = {
    name: '',
    description: '',
    color: '',
  };

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
      error: (err) => {
        this.errorMessage.set(
          err?.error?.detail || 'Не удалось загрузить предметы.',
        );
        this.isLoading.set(false);
      },
    });
  }

  createSubject(): void {
    if (!this.newSubject.name.trim()) {
      this.errorMessage.set('Название предмета обязательно.');
      this.successMessage.set(null);
      return;
    }

    this.api
      .createSubject({
        name: this.newSubject.name.trim(),
        description: this.newSubject.description.trim(),
        color: this.newSubject.color.trim(),
      })
      .subscribe({
        next: (subject) => {
          this.subjects.update((current) =>
            [...current, subject].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.errorMessage.set(null);
          this.successMessage.set('Предмет добавлен.');
          this.newSubject = {
            name: '',
            description: '',
            color: '',
          };
        },
        error: (err) => {
          this.successMessage.set(null);
          this.errorMessage.set(
            err?.error?.detail || 'Не удалось создать предмет.',
          );
        },
      });
  }

  deleteSubject(subject: Subject): void {
    const confirmed = window.confirm(
      `Удалить предмет "${subject.name}"? Все связанные задачи тоже удалятся.`,
    );

    if (!confirmed) {
      return;
    }

    this.api.deleteSubject(subject.id).subscribe({
      next: () => {
        this.subjects.update((current) =>
          current.filter((item) => item.id !== subject.id),
        );
        this.errorMessage.set(null);
        this.successMessage.set('Предмет удалён.');
      },
      error: (err) => {
        this.successMessage.set(null);
        this.errorMessage.set(
          err?.error?.detail || 'Не удалось удалить предмет.',
        );
      },
    });
  }
}
