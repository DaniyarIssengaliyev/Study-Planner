import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Faculty } from '../../models/api.models';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage implements OnInit {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  isLoading = signal(false);
  isFacultiesLoading = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  faculties = signal<Faculty[]>([]);

  form = {
    username: '',
    email: '',
    full_name: '',
    password: '',
    faculty_id: null as number | null,
  };

  ngOnInit(): void {
    this.api.getFaculties().subscribe({
      next: (faculties) => {
        this.faculties.set(faculties);
        this.isFacultiesLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Не удалось загрузить список факультетов.');
        this.isFacultiesLoading.set(false);
      },
    });
  }

  submit(): void {
    if (
      !this.form.username.trim() ||
      !this.form.email.trim() ||
      !this.form.full_name.trim() ||
      !this.form.password.trim()
    ) {
      this.errorMessage.set('Заполните все обязательные поля.');
      this.successMessage.set(null);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.auth
      .register({
        username: this.form.username.trim(),
        email: this.form.email.trim(),
        full_name: this.form.full_name.trim(),
        password: this.form.password,
        faculty_id: this.form.faculty_id,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.successMessage.set('Регистрация прошла успешно. Теперь войдите в аккаунт.');
          setTimeout(() => {
            this.router.navigateByUrl('/login');
          }, 900);
        },
        error: (err) => {
          this.errorMessage.set(this.getRegisterError(err?.error));
          this.isLoading.set(false);
        },
      });
  }

  private getRegisterError(error: Record<string, string[]> | undefined): string {
    if (!error) {
      return 'Не удалось зарегистрироваться. Проверьте данные формы.';
    }

    const firstFieldError = Object.values(error).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    if (firstFieldError) {
      return firstFieldError[0];
    }

    return 'Не удалось зарегистрироваться. Проверьте данные формы.';
  }
}
