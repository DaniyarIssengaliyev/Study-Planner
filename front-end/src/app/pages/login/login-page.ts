import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  form = {
    username: '',
    password: '',
  };

  submit(): void {
    if (!this.form.username.trim() || !this.form.password.trim()) {
      this.errorMessage.set('Enter username and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth
      .login({
        username: this.form.username.trim(),
        password: this.form.password,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          console.error('Login error:', err);
          this.errorMessage.set('Invalid username or password');
          this.isLoading.set(false);
        },
      });
  }
}
