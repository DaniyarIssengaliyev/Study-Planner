export interface Faculty {
  id: number;
  name: string;
}

export interface Profile {
  full_name: string;
  role: 'superadmin' | 'student';
  faculty: Faculty | null;
  google_sub?: string | null;
}

export interface User {
  id: number;
  username: string;
  email: string;
  profile: Profile;
}

export interface Subject {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

export interface Subtask {
  id: number;
  task: number;
  title: string;
  is_completed: boolean;
  order: number;
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
  owner?: number;
  owner_username?: string;
  subtasks?: Subtask[];
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  faculty_id?: number | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
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

export interface CreateSubtaskRequest {
  title: string;
}

export interface UpdateSubtaskRequest {
  title?: string;
  is_completed?: boolean;
  order?: number;
}
