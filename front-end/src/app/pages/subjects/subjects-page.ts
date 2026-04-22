import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FacultyOverview } from '../../models/api.models';

@Component({
  selector: 'app-subjects-page',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './subjects-page.html',
  styleUrl: './subjects-page.css',
})
export class SubjectsPage implements OnInit {
  private api = inject(ApiService);

  faculties = signal<FacultyOverview[]>([]);
  selectedFacultyId = signal<number | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  selectedFaculty = computed(() => {
    const facultyId = this.selectedFacultyId();
    return this.faculties().find((faculty) => faculty.id === facultyId) ?? null;
  });

  ngOnInit(): void {
    this.loadFacultyOverview();
  }

  loadFacultyOverview(): void {
    this.isLoading.set(true);

    this.api.getFacultyOverview().subscribe({
      next: (data) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        this.faculties.set(sorted);
        this.selectedFacultyId.set(sorted[0]?.id ?? null);
        this.errorMessage.set(null);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load faculties and subjects.');
        this.isLoading.set(false);
      },
    });
  }

  selectFaculty(facultyId: number): void {
    this.selectedFacultyId.set(facultyId);
  }
}
