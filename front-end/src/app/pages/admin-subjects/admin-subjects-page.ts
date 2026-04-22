import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Faculty, StudentSummary, Subject } from '../../models/api.models';

type AdminTab = 'subjects' | 'faculties' | 'students';
type DeleteTarget =
  | { type: 'faculty'; id: number; name: string }
  | { type: 'subject'; id: number; name: string };

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
  faculties = signal<Faculty[]>([]);
  students = signal<StudentSummary[]>([]);
  isLoading = signal(true);
  isLoadingFaculties = signal(true);
  isLoadingStudents = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  createErrorMessage = signal<string | null>(null);
  facultyErrorMessage = signal<string | null>(null);
  isSubjectModalOpen = signal(false);
  isFacultyModalOpen = signal(false);
  isDeleteModalOpen = signal(false);
  isDeleting = signal(false);
  deleteTarget = signal<DeleteTarget | null>(null);
  activeTab = signal<AdminTab | null>(null);

  createValidationTriggered = false;
  facultyValidationTriggered = false;
  studentFacultyFilter = signal<string>('all');

  filteredStudents = computed(() => {
    const filter = this.studentFacultyFilter();
    const students = [...this.students()];

    students.sort((a, b) => {
      const facultyCompare = (a.faculty_name || '').localeCompare(b.faculty_name || '');
      if (facultyCompare !== 0) {
        return facultyCompare;
      }
      return a.full_name.localeCompare(b.full_name);
    });

    if (filter === 'all') {
      return students;
    }

    return students.filter((student) => (student.faculty_name || 'No faculty') === filter);
  });

  newSubject = {
    name: '',
    description: '',
    color: '',
    faculty: null as number | null,
  };

  newFaculty = {
    name: '',
  };

  ngOnInit(): void {
    this.loadSubjects();
    this.loadFaculties();
    this.loadStudents();
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
        this.errorMessage.set(err?.error?.detail || 'Failed to load subjects.');
        this.isLoading.set(false);
      },
    });
  }

  loadStudents(): void {
    this.isLoadingStudents.set(true);
    this.api.getStudentSummary().subscribe({
      next: (data) => {
        this.students.set(data);
        this.isLoadingStudents.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load student statistics.');
        this.isLoadingStudents.set(false);
      },
    });
  }

  loadFaculties(): void {
    this.isLoadingFaculties.set(true);
    this.api.getFaculties().subscribe({
      next: (data) => {
        this.faculties.set([...data].sort((a, b) => a.name.localeCompare(b.name)));
        this.isLoadingFaculties.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to load faculties.');
        this.isLoadingFaculties.set(false);
      },
    });
  }

  openTab(tab: AdminTab): void {
    this.activeTab.set(tab);
  }

  closeTab(): void {
    this.activeTab.set(null);
  }

  openSubjectModal(): void {
    this.isSubjectModalOpen.set(true);
    this.createValidationTriggered = false;
    this.createErrorMessage.set(null);
    this.newSubject = {
      name: '',
      description: '',
      color: '',
      faculty: null,
    };
  }

  closeSubjectModal(): void {
    this.isSubjectModalOpen.set(false);
    this.createValidationTriggered = false;
    this.createErrorMessage.set(null);
  }

  createSubject(): void {
    this.createValidationTriggered = true;
    this.createErrorMessage.set(null);
    this.successMessage.set(null);

    if (!this.newSubject.name.trim()) {
      return;
    }

    if (!this.newSubject.faculty) {
      return;
    }

    this.api
      .createSubject({
        name: this.newSubject.name.trim(),
        description: this.newSubject.description.trim(),
        color: this.newSubject.color.trim(),
        faculty: this.newSubject.faculty,
      })
      .subscribe({
        next: (subject) => {
          this.subjects.update((current) =>
            [...current, subject].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.errorMessage.set(null);
          this.createErrorMessage.set(null);
          this.successMessage.set('Subject created.');
          this.createValidationTriggered = false;
          this.newSubject = {
            name: '',
            description: '',
            color: '',
            faculty: null,
          };
          this.closeSubjectModal();
        },
        error: (err) => {
          this.successMessage.set(null);
          this.createErrorMessage.set(err?.error?.detail || 'Failed to create subject.');
        },
      });
  }

  openFacultyModal(): void {
    this.isFacultyModalOpen.set(true);
    this.facultyValidationTriggered = false;
    this.facultyErrorMessage.set(null);
    this.newFaculty = { name: '' };
  }

  closeFacultyModal(): void {
    this.isFacultyModalOpen.set(false);
    this.facultyValidationTriggered = false;
    this.facultyErrorMessage.set(null);
  }

  createFaculty(): void {
    this.facultyValidationTriggered = true;
    this.facultyErrorMessage.set(null);
    this.successMessage.set(null);

    if (!this.newFaculty.name.trim()) {
      return;
    }

    this.api.createFaculty({ name: this.newFaculty.name.trim() }).subscribe({
      next: (faculty) => {
        this.faculties.update((current) =>
          [...current, faculty].sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.facultyErrorMessage.set(null);
        this.successMessage.set('Faculty created.');
        this.facultyValidationTriggered = false;
        this.newFaculty = { name: '' };
        this.closeFacultyModal();
      },
      error: (err) => {
        this.successMessage.set(null);
        this.facultyErrorMessage.set(err?.error?.detail || 'Failed to create faculty.');
      },
    });
  }

  deleteFaculty(faculty: Faculty): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deleteTarget.set({ type: 'faculty', id: faculty.id, name: faculty.name });
    this.isDeleteModalOpen.set(true);
  }

  deleteSubject(subject: Subject): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deleteTarget.set({ type: 'subject', id: subject.id, name: subject.name });
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.isDeleting()) {
      return;
    }

    this.isDeleteModalOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }

    this.isDeleting.set(true);

    if (target.type === 'faculty') {
      this.api.deleteFaculty(target.id).subscribe({
        next: () => {
          this.faculties.update((current) => current.filter((item) => item.id !== target.id));
          if (this.studentFacultyFilter() === target.name) {
            this.studentFacultyFilter.set('all');
          }
          this.loadStudents();
          this.successMessage.set('Faculty deleted.');
          this.isDeleting.set(false);
          this.closeDeleteModal();
        },
        error: (err) => {
          this.successMessage.set(null);
          this.errorMessage.set(err?.error?.detail || 'Failed to delete faculty.');
          this.isDeleting.set(false);
        },
      });
      return;
    }

    this.api.deleteSubject(target.id).subscribe({
      next: () => {
        this.subjects.update((current) => current.filter((item) => item.id !== target.id));
        this.errorMessage.set(null);
        this.successMessage.set('Subject deleted.');
        this.isDeleting.set(false);
        this.closeDeleteModal();
      },
      error: (err) => {
        this.successMessage.set(null);
        this.errorMessage.set(err?.error?.detail || 'Failed to delete subject.');
        this.isDeleting.set(false);
      },
    });
  }

  showCreateFieldError(field: 'name' | 'faculty'): boolean {
    if (!this.createValidationTriggered) {
      return false;
    }

    if (field === 'name') {
      return !this.newSubject.name.trim();
    }

    return !this.newSubject.faculty;
  }

  showFacultyFieldError(field: 'name'): boolean {
    return field === 'name' && this.facultyValidationTriggered && !this.newFaculty.name.trim();
  }
}
