import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  Subject,
  CreateSubjectRequest,
} from '../models/api.models';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://127.0.0.1:8000/api';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('study_planner_access_token');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`,
        })
      : new HttpHeaders();
  }

  register(data: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/auth/register/`, data);
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login/`, data);
  }

  googleLogin(credential: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/google/`, {
      credential,
    });
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getTaskById(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  createTask(data: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  updateTask(id: number, data: UpdateTaskRequest): Observable<Task> {
    return this.http.put<Task>(`${this.baseUrl}/tasks/${id}/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.baseUrl}/subjects/`, {
      headers: this.getAuthHeaders(),
    });
  }

  createSubject(data: CreateSubjectRequest): Observable<Subject> {
    return this.http.post<Subject>(`${this.baseUrl}/subjects/`, data, {
      headers: this.getAuthHeaders(),
    });
  }
}
