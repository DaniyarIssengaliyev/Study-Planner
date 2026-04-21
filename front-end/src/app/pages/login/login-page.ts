import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GoogleCredentialResponse } from '../../models/google.types';

const GOOGLE_CLIENT_ID =
  '1023483995845-v6ofsa2n0i1g8iiqukkpejrraeffi1ec.apps.googleusercontent.com';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  form = {
    login: '',
    password: '',
  };

  private googleRenderAttempts = 0;
  private googleRenderTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.tryRenderGoogleButton();
  }

  ngOnDestroy(): void {
    if (this.googleRenderTimer) {
      clearTimeout(this.googleRenderTimer);
      this.googleRenderTimer = null;
    }

    const container = document.getElementById('google-signin-button');
    if (container) {
      container.innerHTML = '';
    }
  }

  submit(): void {
    if (!this.form.login.trim() || !this.form.password.trim()) {
      this.errorMessage.set('Введите email или username и пароль.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.auth
      .login({
        login: this.form.login.trim(),
        password: this.form.password,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigateByUrl(this.auth.getDefaultRoute());
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.detail ||
              err?.error?.login?.[0] ||
              'Неверный логин или пароль.',
          );
          this.isLoading.set(false);
        },
      });
  }

  private tryRenderGoogleButton(): void {
    const googleApi = window.google?.accounts?.id;
    const container = document.getElementById('google-signin-button');

    if (!container || !GOOGLE_CLIENT_ID) {
      return;
    }

    if (!googleApi) {
      if (this.googleRenderAttempts < 20) {
        this.googleRenderAttempts += 1;
        this.googleRenderTimer = setTimeout(() => {
          this.tryRenderGoogleButton();
        }, 300);
      }
      return;
    }

    container.innerHTML = '';

    googleApi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: GoogleCredentialResponse) => {
        if (!response.credential) {
          this.zone.run(() => {
            this.errorMessage.set('Не удалось войти через Google.');
          });
          return;
        }

        this.zone.run(() => {
          this.isLoading.set(true);
          this.errorMessage.set(null);

          this.auth.googleLogin(response.credential).subscribe({
            next: () => {
              this.isLoading.set(false);
              this.router.navigateByUrl(this.auth.getDefaultRoute());
            },
            error: (err) => {
              this.errorMessage.set(
                err?.error?.detail || 'Не удалось войти через Google.',
              );
              this.isLoading.set(false);
            },
          });
        });
      },
    });

    googleApi.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 320,
    });
  }
}
