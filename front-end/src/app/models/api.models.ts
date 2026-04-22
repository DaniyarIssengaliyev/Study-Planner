export interface Faculty {
  id: number;
  name: string;
}

export interface CreateFacultyRequest {
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
  faculty?: number | null;
  faculty_name?: string | null;
}

export interface Board {
  id: number;
  title: string;
  description: string;
  subject: number | null;
  subject_name?: string | null;
  owner?: number;
  created_at: string;
  tasks_count?: number;
  completed_tasks_count?: number;
}

export interface StudentSummary {
  id: number;
  username: string;
  full_name: string;
  faculty_id?: number | null;
  faculty_name?: string | null;
  boards_count: number;
  tasks_count: number;
  completed_tasks_count: number;
  overdue_tasks_count: number;
}

export interface FacultyOverview {
  id: number;
  name: string;
  subjects: Subject[];
  students: StudentSummary[];
  analytics: FacultyAnalytics;
}

export interface FacultyAnalyticsBucket {
  label: string;
  value: number;
}

export interface FacultyAnalyticsItem {
  name: string;
  value: number;
}

export interface FacultyAnalytics {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  todo_tasks: number;
  completion_rate: number;
  subject_load: FacultyAnalyticsItem[];
  deadline_buckets: FacultyAnalyticsBucket[];
}

export interface Subtask {
  id: number;
  task: number;
  title: string;
  is_completed: boolean;
  order: number;
  completed_at?: string | null;
}

export interface TaskActivity {
  id: number;
  event_type: 'task_completed' | 'task_reopened' | 'subtask_completed' | 'subtask_reopened';
  message: string;
  created_at: string;
  subtask?: number | null;
  subtask_title?: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  completed_at?: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  subject: number;
  subject_name?: string;
  board?: number | null;
  board_title?: string | null;
  owner?: number;
  owner_username?: string;
  subtasks?: Subtask[];
  progress_percentage?: number;
  completed_subtasks_count?: number;
  total_subtasks_count?: number;
  activity_log?: TaskActivity[];
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

export interface UpdateProfileSettingsRequest {
  email: string;
  faculty_id?: number | null;
  current_password?: string;
  new_password?: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface CreateBoardRequest {
  title: string;
  description: string;
  subject?: number | null;
}

export interface UpdateBoardRequest extends Partial<CreateBoardRequest> {}

export interface CreateTaskRequest {
  title: string;
  description: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  subject: number;
  board?: number | null;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

export interface CreateSubjectRequest {
  name: string;
  color?: string;
  description?: string;
  faculty: number | null;
}

export interface CreateSubtaskRequest {
  title: string;
}

export interface UpdateSubtaskRequest {
  title?: string;
  is_completed?: boolean;
  order?: number;
}
