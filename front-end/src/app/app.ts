import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { Faculty } from './models/api.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  isBootstrapping = signal(true);
  isProfileModalOpen = signal(false);
  isSavingProfile = signal(false);
  isLoadingFaculties = signal(false);
  faculties = signal<Faculty[]>([]);
  profileErrorMessage = signal<string | null>(null);
  profileSuccessMessage = signal<string | null>(null);
  emailFieldAnimated = signal(false);
  isEmailInvalid = signal(false);

  profileForm = this.getEmptyProfileForm();

  ngOnInit(): void {
    const token = this.auth.getToken();

    if (!token) {
      this.isBootstrapping.set(false);
      return;
    }

    this.auth.loadMe().subscribe({
      next: () => {
        this.isBootstrapping.set(false);
      },
      error: () => {
        this.auth.logout();
        this.isBootstrapping.set(false);
        this.router.navigateByUrl('/login');
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openProfileModal(): void {
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }

    this.profileForm = {
      email: user.email ?? '',
      faculty_id: user.profile.faculty?.id ?? null,
      current_password: '',
      new_password: '',
    };
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.isEmailInvalid.set(false);
    this.emailFieldAnimated.set(false);
    this.isProfileModalOpen.set(true);

    if (this.faculties().length === 0) {
      this.loadFaculties();
    }
  }

  closeProfileModal(): void {
    if (this.isSavingProfile()) {
      return;
    }

    this.isProfileModalOpen.set(false);
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.isEmailInvalid.set(false);
    this.emailFieldAnimated.set(false);
  }

  saveFacultySettings(): void {
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }

    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);

    this.submitProfileUpdate({
      email: user.email,
      faculty_id: this.profileForm.faculty_id,
    }, 'Faculty updated.');
  }

  saveEmailSettings(): void {
    const email = this.profileForm.email.trim();

    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);

    if (!this.validateEmail(email)) {
      this.markEmailInvalid('Enter a valid email address.');
      return;
    }

    this.isEmailInvalid.set(false);

    this.submitProfileUpdate(
      {
        email,
        faculty_id: this.auth.currentUser()?.profile.faculty?.id ?? null,
      },
      'Email updated.',
    );
  }

  savePasswordSettings(): void {
    const user = this.auth.currentUser();
    if (!user) {
      return;
    }

    const currentPassword = this.profileForm.current_password.trim();
    const newPassword = this.profileForm.new_password.trim();

    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);

    if (!currentPassword || !newPassword) {
      this.profileErrorMessage.set('Enter current password and new password.');
      return;
    }

    this.submitProfileUpdate(
      {
        email: user.email,
        faculty_id: user.profile.faculty?.id ?? null,
        current_password: currentPassword,
        new_password: newPassword,
      },
      'Password updated.',
      () => {
        this.profileForm.current_password = '';
        this.profileForm.new_password = '';
      },
    );
  }

  onEmailInput(): void {
    if (this.isEmailInvalid()) {
      this.isEmailInvalid.set(false);
      this.emailFieldAnimated.set(false);
    }
  }

  roleLabel(): string {
    const role = this.auth.currentUser()?.profile.role;
    return role === 'superadmin' ? 'Superadmin' : 'Student';
  }

  facultyLabel(): string {
    return this.auth.currentUser()?.profile.faculty?.name || 'Faculty not selected';
  }

  private loadFaculties(): void {
    this.isLoadingFaculties.set(true);

    this.api.getFaculties().subscribe({
      next: (faculties) => {
        this.faculties.set([...faculties].sort((a, b) => a.name.localeCompare(b.name)));
        this.isLoadingFaculties.set(false);
      },
      error: () => {
        this.profileErrorMessage.set('Failed to load faculties.');
        this.isLoadingFaculties.set(false);
      },
    });
  }

  private submitProfileUpdate(
    payload: {
      email: string;
      faculty_id?: number | null;
      current_password?: string;
      new_password?: string;
    },
    successMessage: string,
    onSuccess?: () => void,
  ): void {
    this.isSavingProfile.set(true);

    this.api.updateProfileSettings(payload).subscribe({
      next: (updatedUser) => {
        this.auth.applyCurrentUser(updatedUser);

        if (payload.email) {
          this.profileForm.email = updatedUser.email;
        }

        if (typeof payload.faculty_id !== 'undefined') {
          this.profileForm.faculty_id = updatedUser.profile.faculty?.id ?? null;
        }

        onSuccess?.();
        this.profileSuccessMessage.set(successMessage);
        this.isSavingProfile.set(false);
      },
      error: (err) => {
        this.profileErrorMessage.set(
          this.extractErrorMessage(err?.error) || 'Failed to update profile.',
        );
        this.isSavingProfile.set(false);
      },
    });
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private markEmailInvalid(message: string): void {
    this.isEmailInvalid.set(true);
    this.emailFieldAnimated.set(false);
    this.profileErrorMessage.set(message);

    setTimeout(() => {
      this.emailFieldAnimated.set(true);
    }, 10);
  }

  private getEmptyProfileForm() {
    return {
      email: '',
      faculty_id: null as number | null,
      current_password: '',
      new_password: '',
    };
  }

  private extractErrorMessage(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const detail = (error as { detail?: unknown }).detail;
      if (typeof detail === 'string') {
        return detail;
      }

      const values = Object.values(error as Record<string, unknown>);
      for (const value of values) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
          return value[0];
        }
        if (typeof value === 'string') {
          return value;
        }
      }
    }

    return null;
  }
}
