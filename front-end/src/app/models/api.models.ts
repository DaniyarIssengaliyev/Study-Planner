export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Subject {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  subject: number;
  subject_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh?: string;
  user?: User;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  subject: number;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

export interface CreateSubjectRequest {
  name: string;
  color?: string;
  description?: string;
}
