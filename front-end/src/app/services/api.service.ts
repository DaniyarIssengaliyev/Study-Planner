import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  Board,
  CreateFacultyRequest,
  CreateBoardRequest,
  CreateSubjectRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  Faculty,
  FacultyOverview,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  Subject,
  StudentSummary,
  Subtask,
  Task,
  UpdateProfileSettingsRequest,
  UpdateBoardRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
  User,
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

  updateProfileSettings(data: UpdateProfileSettingsRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/auth/profile/settings/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  getFaculties(): Observable<Faculty[]> {
    return this.http.get<Faculty[]>(`${this.baseUrl}/faculties/`);
  }

  getFacultyOverview(): Observable<FacultyOverview[]> {
    return this.http.get<FacultyOverview[]>(`${this.baseUrl}/faculties/overview/`, {
      headers: this.getAuthHeaders(),
    });
  }

  createFaculty(data: CreateFacultyRequest): Observable<Faculty> {
    return this.http.post<Faculty>(`${this.baseUrl}/faculties/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteFaculty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/faculties/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getBoards(): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.baseUrl}/boards/`, {
      headers: this.getAuthHeaders(),
    });
  }

  createBoard(data: CreateBoardRequest): Observable<Board> {
    return this.http.post<Board>(`${this.baseUrl}/boards/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  updateBoard(id: number, data: UpdateBoardRequest): Observable<Board> {
    return this.http.put<Board>(`${this.baseUrl}/boards/${id}/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/boards/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getTasks(boardId?: number | null): Observable<Task[]> {
    let params = new HttpParams();

    if (boardId) {
      params = params.set('board', String(boardId));
    }

    return this.http.get<Task[]>(`${this.baseUrl}/tasks/`, {
      headers: this.getAuthHeaders(),
      params,
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

  createSubtask(taskId: number, data: CreateSubtaskRequest): Observable<Subtask> {
    return this.http.post<Subtask>(`${this.baseUrl}/tasks/${taskId}/subtasks/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  updateSubtask(id: number, data: UpdateSubtaskRequest): Observable<Subtask> {
    return this.http.put<Subtask>(`${this.baseUrl}/subtasks/${id}/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteSubtask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/subtasks/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.baseUrl}/subjects/`, {
      headers: this.getAuthHeaders(),
    });
  }

  getStudentSummary(): Observable<StudentSummary[]> {
    return this.http.get<StudentSummary[]>(`${this.baseUrl}/students/summary/`, {
      headers: this.getAuthHeaders(),
    });
  }

  createSubject(data: CreateSubjectRequest): Observable<Subject> {
    return this.http.post<Subject>(`${this.baseUrl}/subjects/`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteSubject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/subjects/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }
}
