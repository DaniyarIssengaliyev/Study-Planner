import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  form = {
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'student' as 'student' | 'superadmin',
  };

  submit(): void {
    if (
      !this.form.username.trim() ||
      !this.form.email.trim() ||
      !this.form.full_name.trim() ||
      !this.form.password.trim()
    ) {
      this.errorMessage.set('Fill in all fields');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth
      .register({
        username: this.form.username.trim(),
        email: this.form.email.trim(),
        full_name: this.form.full_name.trim(),
        password: this.form.password,
        role: this.form.role,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigateByUrl('/login');
        },
        error: (err) => {
          console.error('Register error:', err);
          this.errorMessage.set('Registration failed. Check username/email.');
          this.isLoading.set(false);
        },
      });
  }
}
