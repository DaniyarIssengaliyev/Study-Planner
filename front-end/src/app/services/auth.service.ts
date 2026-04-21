import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '../models/api.models';
import '../models/google.types';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private api = inject(ApiService);
  private tokenKey = 'study_planner_access_token';

  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());
  isSuperadmin = computed(() => this.currentUser()?.profile.role === 'superadmin');

  register(data: RegisterRequest): Observable<User> {
    return this.api.register(data);
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.api.login(data).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.access);
        this.currentUser.set(response.user);
      }),
    );
  }

  googleLogin(credential: string): Observable<LoginResponse> {
    return this.api.googleLogin(credential).pipe(
      tap((response) => {
        localStorage.setItem(this.tokenKey, response.access);
        this.currentUser.set(response.user);
      }),
    );
  }

  loadMe(): Observable<User> {
    return this.api.getMe().pipe(
      tap((user) => {
        this.currentUser.set(user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUser.set(null);

    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
}
