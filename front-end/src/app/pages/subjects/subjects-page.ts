import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subject } from '../../models/api.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-subjects-page',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './subjects-page.html',
  styleUrl: './subjects-page.css',
})
export class SubjectsPage implements OnInit {
  private api = inject(ApiService);

  subjects = signal<Subject[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
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
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.errorMessage.set('Failed to load subjects');
        this.isLoading.set(false);
      },
    });
  }

  createSubject(): void {
    if (!this.newSubject.name.trim()) {
      this.errorMessage.set('Subject name is required');
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
          this.subjects.update((current) => current.concat(subject));
          this.errorMessage.set('');
          this.newSubject = {
            name: '',
            description: '',
            color: '',
          };
        },
        error: (err) => {
          console.error('Error creating subject:', err);
          this.errorMessage.set('Failed to create subject');
        },
      });
  }
}
