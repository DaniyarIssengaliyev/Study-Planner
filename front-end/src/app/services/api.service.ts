import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  LoginRequest,
  LoginResponse,
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

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login/`, data);
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/`);
  }

  getTaskById(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}/`);
  }

  createTask(data: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.baseUrl}/tasks/`, data);
  }

  updateTask(id: number, data: UpdateTaskRequest): Observable<Task> {
    return this.http.put<Task>(`${this.baseUrl}/tasks/${id}/`, data);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${id}/`);
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.baseUrl}/subjects/`);
  }

  createSubject(data: CreateSubjectRequest): Observable<Subject> {
    return this.http.post<Subject>(`${this.baseUrl}/subjects/`, data);
  }
}
